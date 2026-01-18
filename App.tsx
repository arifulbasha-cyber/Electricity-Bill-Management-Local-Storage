
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { BillConfig, MeterReading, BillCalculationResult, UserCalculation, SavedBill, TariffConfig, Slab } from './types';
import { INITIAL_CONFIG, INITIAL_METERS, INITIAL_MAIN_METER, DEFAULT_TARIFF_CONFIG } from './constants';
import Dashboard from './components/Dashboard';
import ConsumptionStats from './components/ConsumptionStats';
import BillHistory from './components/BillHistory';
import BillEstimator from './components/BillEstimator';
import TariffSettings from './components/TariffSettings';
import TrendsDashboard from './components/TrendsDashboard';
import CloudSetupModal from './components/CloudSetupModal';
import MobileNav from './components/MobileNav';
import SkeletonLoader from './components/SkeletonLoader';
import { Lightbulb, Database, Settings, Cloud, Moon, Sun, Menu, PieChart, BarChart3, RefreshCw, Plus, Save, UploadCloud, DownloadCloud, FastForward } from 'lucide-react';
import { LanguageProvider, useLanguage } from './i18n';
import { ThemeProvider, useTheme } from './components/ThemeContext';
import { spreadsheetService } from './services/spreadsheet';
import { StatusBar, Style } from '@capacitor/status-bar';

const sortBills = (bills: SavedBill[]) => {
  return [...bills].sort((a, b) => {
    const dateA = a.config.dateGenerated;
    const dateB = b.config.dateGenerated;
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
  });
};

const calculateEnergyCost = (units: number, slabs: Slab[]): number => {
  let remainingUnits = units;
  let energyCost = 0;
  let previousLimit = 0;

  for (const slab of slabs) {
    const slabSize = slab.limit - previousLimit;
    const unitsInSlab = Math.min(remainingUnits, slabSize);
    
    if (unitsInSlab > 0) {
      energyCost += unitsInSlab * slab.rate;
      remainingUnits -= unitsInSlab;
    }
    previousLimit = slab.limit;
    if (remainingUnits <= 0) break;
  }

  if (remainingUnits > 0 && slabs.length > 0) {
      const lastRate = slabs[slabs.length - 1].rate;
      energyCost += remainingUnits * lastRate;
  }
  return energyCost;
};

const calculateBillBreakdown = (
  config: BillConfig, 
  mainMeter: MeterReading,
  meters: MeterReading[], 
  tariffConfig: TariffConfig
): BillCalculationResult => {
    const VAT_RATE = tariffConfig.vatRate; 
    const DEMAND_CHARGE = tariffConfig.demandCharge;
    const METER_RENT = tariffConfig.meterRent;
    
    const mainUnits = Math.max(0, mainMeter.current - mainMeter.previous);
    const energyCostBase = calculateEnergyCost(mainUnits, tariffConfig.slabs);
    const fixedBase = DEMAND_CHARGE + METER_RENT;
    const taxableBase = energyCostBase + fixedBase;
    const vatTotal = taxableBase * VAT_RATE;
    const lateFee = config.includeLateFee ? vatTotal : 0;
    const bkash = config.includeBkashFee ? tariffConfig.bkashCharge : 0;
    
    const totalBillCalculated = taxableBase + vatTotal + lateFee + bkash;
    const vatFixed = fixedBase * VAT_RATE;
    const vatDistributed = vatTotal - vatFixed;
    
    let totalSubmeterUnits = 0;
    meters.forEach(m => {
      const units = m.current - m.previous;
      totalSubmeterUnits += units > 0 ? units : 0;
    });

    const fixedSharedPool = fixedBase + vatFixed + bkash + lateFee;
    const fixedCostPerUser = meters.length > 0 ? fixedSharedPool / meters.length : 0;

    const energySharedPool = energyCostBase + vatDistributed;
    const calculatedRate = totalSubmeterUnits > 0 ? energySharedPool / totalSubmeterUnits : 0;

    const userCalculations: UserCalculation[] = meters.map(m => {
      const units = Math.max(0, m.current - m.previous);
      const userEnergyCost = units * calculatedRate;
      const totalPayable = userEnergyCost + fixedCostPerUser;
      return {
        id: m.id,
        name: m.name,
        unitsUsed: units,
        energyCost: userEnergyCost,
        fixedCost: fixedCostPerUser,
        totalPayable: totalPayable,
        previous: m.previous,
        current: m.current
      };
    });

    return { 
      vatFixed, 
      vatDistributed, 
      vatTotal, 
      lateFee, 
      calculatedRate, 
      totalUnits: totalSubmeterUnits, 
      userCalculations, 
      totalCollection: totalBillCalculated
    };
};

const AppContent: React.FC = () => {
  const { t, translateMonth } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  type AppView = 'home' | 'estimator' | 'history' | 'stats' | 'trends' | 'tariff';
  const [currentView, setCurrentView] = useState<AppView>('estimator');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'none' | 'cloud'>('none');
  const [config, setConfig] = useState<BillConfig>(INITIAL_CONFIG);
  const [mainMeter, setMainMeter] = useState<MeterReading>(INITIAL_MAIN_METER);
  const [meters, setMeters] = useState<MeterReading[]>(INITIAL_METERS);
  const [history, setHistory] = useState<SavedBill[]>([]);
  const [tariffConfig, setTariffConfig] = useState<TariffConfig>(DEFAULT_TARIFF_CONFIG);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMenuOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  useEffect(() => {
    const handleStatusBar = async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Light });
      } catch (e) {}
    };
    handleStatusBar();
  }, []);

  const pushCloudData = useCallback(async () => {
    if (!spreadsheetService.isReady()) {
      setActiveModal('cloud');
      return;
    }
    setIsSyncing(true);
    try {
      const now = Date.now();
      await spreadsheetService.saveDraft({ updatedAt: now, config, mainMeter, meters });
      await spreadsheetService.saveTariff(tariffConfig);
      await spreadsheetService.saveHistory(history);
      alert("Successfully pushed local data to Cloud.");
    } catch (error: any) { 
      console.error("Cloud push error", error);
      alert(`Push failed: ${error.message || "Unknown error"}`); 
    } finally { 
      setIsSyncing(false); 
    }
  }, [config, mainMeter, meters, tariffConfig, history]);

  const pullCloudData = useCallback(async () => {
    if (!spreadsheetService.isReady()) {
      setActiveModal('cloud');
      return;
    }
    setIsSyncing(true);
    try {
      const [cloudDraft, cloudHistory, cloudTariff] = await Promise.all([
        spreadsheetService.getDraft(),
        spreadsheetService.getBills(),
        spreadsheetService.getTariff()
      ]);
      
      if (cloudDraft) {
        setConfig(cloudDraft.config);
        setMainMeter(cloudDraft.mainMeter);
        setMeters(cloudDraft.meters);
        localStorage.setItem('tmss_draft_config', JSON.stringify(cloudDraft.config));
        localStorage.setItem('tmss_draft_main_meter', JSON.stringify(cloudDraft.mainMeter));
        localStorage.setItem('tmss_draft_meters', JSON.stringify(cloudDraft.meters));
      }
      if (cloudHistory) { 
        setHistory(sortBills(cloudHistory)); 
        localStorage.setItem('tmss_bill_history', JSON.stringify(cloudHistory)); 
      }
      if (cloudTariff) { 
        setTariffConfig(cloudTariff); 
        localStorage.setItem('tmss_tariff_config', JSON.stringify(cloudTariff)); 
      }
      
      alert("Successfully pulled data from Cloud. Local data updated.");
    } catch (error: any) {
      console.error("Cloud pull error", error);
      alert(`Pull failed: ${error.message || "Unknown error"}`);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const savedHistory = localStorage.getItem('tmss_bill_history');
    if (savedHistory) setHistory(sortBills(JSON.parse(savedHistory)));
    const savedTariff = localStorage.getItem('tmss_tariff_config');
    if (savedTariff) setTariffConfig(JSON.parse(savedTariff));
    const savedDraft = localStorage.getItem('tmss_draft_config');
    if (savedDraft) {
        setConfig(JSON.parse(savedDraft));
        const m = localStorage.getItem('tmss_draft_meters');
        if (m) setMeters(JSON.parse(m));
        const main = localStorage.getItem('tmss_draft_main_meter');
        if (main) setMainMeter(JSON.parse(main));
    }
  }, []);

  // Sync to local storage on changes (but NOT cloud)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    localStorage.setItem('tmss_draft_config', JSON.stringify(config));
    localStorage.setItem('tmss_draft_main_meter', JSON.stringify(mainMeter));
    localStorage.setItem('tmss_draft_meters', JSON.stringify(meters));
  }, [config, mainMeter, meters]);

  const handleViewChange = (view: AppView) => {
      setCurrentView(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTariffSave = async (newConfig: TariffConfig) => {
      setTariffConfig(newConfig);
      if (config.includeBkashFee) setConfig(prev => ({ ...prev, bkashFee: newConfig.bkashCharge }));
      localStorage.setItem('tmss_tariff_config', JSON.stringify(newConfig));
  };

  const saveToHistory = async () => {
    const updatedConfig = { ...config, totalBillPayable: calculationResult.totalCollection };
    const newRecord: SavedBill = { id: Date.now().toString(), savedAt: new Date().toISOString(), config: updatedConfig, mainMeter: { ...mainMeter }, meters: [...meters] };
    const updatedHistory = sortBills([newRecord, ...history]);
    setHistory(updatedHistory);
    localStorage.setItem('tmss_bill_history', JSON.stringify(updatedHistory));
    alert("Bill saved to history.");
  };

  const handleNextMonth = () => {
    if (window.confirm(t('confirm_next_month'))) {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const currentIndex = monthNames.indexOf(config.month);
      const nextMonth = monthNames[(currentIndex + 1) % 12];
      
      setConfig(prev => ({
        ...prev,
        month: nextMonth,
        dateGenerated: new Date().toISOString().split('T')[0]
      }));

      setMainMeter(prev => ({
        ...prev,
        previous: prev.current,
      }));

      setMeters(prev => prev.map(m => ({
        ...m,
        previous: m.current,
      })));
      
      setCurrentView('home');
      alert(`Reading rolled over for ${translateMonth(nextMonth)}.`);
    }
  };

  const loadFromHistory = (record: SavedBill) => {
    if (window.confirm(t('confirm_load').replace('{month}', record.config.month))) {
      setConfig({ ...record.config });
      setMainMeter(record.mainMeter);
      setMeters(record.meters);
      setCurrentView('home');
    }
  };

  const calculationResult: BillCalculationResult = useMemo(() => calculateBillBreakdown(config, mainMeter, meters, tariffConfig), [config, mainMeter, meters, tariffConfig]);

  const renderView = () => {
    if (isInitialLoading) return <SkeletonLoader />;
    switch(currentView) {
      case 'home': return <Dashboard config={config} result={calculationResult} mainMeter={mainMeter} meters={meters} onUpdateMeters={setMeters} onMainMeterUpdate={setMainMeter} onConfigUpdate={setConfig} tenants={[]} tariffConfig={tariffConfig} onSaveHistory={saveToHistory} />;
      case 'estimator': return <BillEstimator tariffConfig={tariffConfig} />;
      case 'history': return <BillHistory history={history} onLoad={loadFromHistory} onDelete={(id) => { const h = history.filter(h => h.id !== id); setHistory(h); localStorage.setItem('tmss_bill_history', JSON.stringify(h)); }} onViewReport={loadFromHistory} />;
      case 'stats': return <ConsumptionStats calculations={calculationResult.userCalculations} totalUnits={calculationResult.totalUnits} />;
      case 'trends': return <TrendsDashboard history={history} />;
      case 'tariff': return <TariffSettings config={tariffConfig} onSave={handleTariffSave} />;
      default: return null;
    }
  };

  const headerTitle = useMemo(() => {
    switch(currentView) {
      case 'estimator': return 'Calculator';
      case 'home': return 'Splitter';
      case 'history': return 'History';
      case 'tariff': return t('tariff_settings');
      case 'trends': return t('trends_dashboard');
      case 'stats': return t('consumption_share');
      default: return 'Electricity Bill Calculator';
    }
  }, [currentView, t]);

  return (
    <div className="min-h-screen bg-transparent pb-safe transition-colors duration-500">
      <header className="sticky top-0 z-30 no-print pt-safe border-b border-slate-200/50 dark:border-white/5 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl shadow-sm">
        <div className="px-5 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
              <button onClick={() => setIsMenuOpen(true)} className="p-2 text-slate-900 dark:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-2xl transition-all">
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">{headerTitle}</h1>
              </div>
          </div>
            
          <div className="flex items-center gap-2">
            {currentView === 'home' && (
              <>
                <button onClick={() => { const m: MeterReading = { id: Date.now().toString(), name: '', meterNo: (meters.length+1).toString(), previous: 0, current: 0 }; setMeters([...meters, m]); }} className="p-3 text-slate-900 dark:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-2xl transition-all active:scale-90" title="Add Meter">
                  <Plus className="w-6 h-6" />
                </button>
                <button onClick={handleNextMonth} className="p-3 text-slate-900 dark:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-2xl transition-all active:scale-90" title={t('next_month')}>
                  <FastForward className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsMenuOpen(false)}></div>
          <div ref={menuRef} className="fixed left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 z-[101] animate-in slide-in-from-left duration-300 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-indigo-900 text-white">
                <div className="text-lg font-black uppercase tracking-widest">Navigation</div>
            </div>
            <div className="flex-1 py-4 overflow-y-auto">
              <button onClick={() => { handleViewChange('home'); setIsMenuOpen(false); }} className="w-full text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-4">
                <Lightbulb className="w-5 h-5 text-indigo-500" /> Splitter
              </button>
              <button onClick={() => { handleViewChange('estimator'); setIsMenuOpen(false); }} className="w-full text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-4">
                <Database className="w-5 h-5 text-indigo-500" /> Calculator
              </button>
              <button onClick={() => { handleViewChange('stats'); setIsMenuOpen(false); }} className="w-full text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-4">
                <PieChart className="w-5 h-5 text-indigo-500" /> Consumption Share
              </button>
              <button onClick={() => { handleViewChange('trends'); setIsMenuOpen(false); }} className="w-full text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-4">
                <BarChart3 className="w-5 h-5 text-indigo-500" /> Trends & Analytics
              </button>
              <div className="mx-6 my-2 border-t border-slate-100 dark:border-slate-800"></div>
              <button onClick={() => { handleViewChange('tariff'); setIsMenuOpen(false); }} className="w-full text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-4">
                <Settings className="w-5 h-5 text-slate-500" /> Master Tariff Settings
              </button>
              <button onClick={() => { setActiveModal('cloud'); setIsMenuOpen(false); }} className="w-full text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-4">
                <Cloud className="w-5 h-5 text-indigo-500" /> Cloud Setup
              </button>
              
              <div className="mx-6 my-2 border-t border-slate-100 dark:border-slate-800"></div>
              
              <div className="px-6 py-4 space-y-3">
                 <button 
                   onClick={() => { pullCloudData(); setIsMenuOpen(false); }} 
                   className="w-full h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition-all active:scale-95"
                 >
                    <DownloadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} /> Pull from Cloud
                 </button>
                 <button 
                   onClick={() => { pushCloudData(); setIsMenuOpen(false); }} 
                   className="w-full h-12 rounded-xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95"
                 >
                    <UploadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} /> Push to Cloud
                 </button>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button onClick={toggleTheme} className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-90 transition-all">
                {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">v1.2.1</span>
            </div>
          </div>
        </>
      )}

      <main className="max-w-3xl mx-auto px-5 py-6 print:p-0 pb-24 relative">
        {renderView()}
      </main>
      <MobileNav currentView={currentView as any} onChangeView={handleViewChange} />
      <CloudSetupModal isOpen={activeModal === 'cloud'} onClose={() => setActiveModal('none')} onConnected={() => { setIsMenuOpen(false); }} />
    </div>
  );
};

const App: React.FC = () => (
  <ThemeProvider>
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  </ThemeProvider>
);

export default App;
