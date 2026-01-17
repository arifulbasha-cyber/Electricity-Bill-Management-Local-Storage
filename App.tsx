
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { BillConfig, MeterReading, BillCalculationResult, UserCalculation, SavedBill, TariffConfig, Tenant, Slab } from './types';
import { INITIAL_CONFIG, INITIAL_METERS, INITIAL_MAIN_METER, DEFAULT_TARIFF_CONFIG } from './constants';
import Dashboard from './components/Dashboard';
import ConsumptionStats from './components/ConsumptionStats';
import BillHistory from './components/BillHistory';
import BillEstimator from './components/BillEstimator';
import TariffSettings from './components/TariffSettings';
import TenantManager from './components/TenantManager';
import TrendsDashboard from './components/TrendsDashboard';
import CloudSetupModal from './components/CloudSetupModal';
import MobileNav from './components/MobileNav';
import SkeletonLoader from './components/SkeletonLoader';
import { Lightbulb, Database, Settings, Users, Cloud, Moon, Sun, Menu, ArrowRight, PieChart, BarChart3, RefreshCw, FileSpreadsheet, UploadCloud, DownloadCloud, Plus, Save } from 'lucide-react';
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
    
    // 1. Calculate Main Meter Units (for base reference)
    const mainUnits = Math.max(0, mainMeter.current - mainMeter.previous);
    
    // 2. Calculate Total Bill (System Total) based on Main Meter
    const energyCostBase = calculateEnergyCost(mainUnits, tariffConfig.slabs);
    const fixedBase = DEMAND_CHARGE + METER_RENT;
    const taxableBase = energyCostBase + fixedBase;
    const vatTotal = taxableBase * VAT_RATE;
    const lateFee = config.includeLateFee ? vatTotal : 0;
    const bkash = config.includeBkashFee ? tariffConfig.bkashCharge : 0;
    
    const totalBillCalculated = taxableBase + vatTotal + lateFee + bkash;

    // 3. VAT Distribution (User's specific request)
    // VAT Fixed = (Demand Charge + Meter Rent) * 5%
    const vatFixed = fixedBase * VAT_RATE;
    // VAT Distributed = Total VAT - VAT Fixed
    const vatDistributed = vatTotal - vatFixed;
    
    // 4. Calculate Sub-meter Total Units
    let totalSubmeterUnits = 0;
    meters.forEach(m => {
      const units = m.current - m.previous;
      totalSubmeterUnits += units > 0 ? units : 0;
    });

    // 5. Shared Pool (Fixed Costs)
    const fixedSharedPool = fixedBase + vatFixed + bkash + lateFee;
    const fixedCostPerUser = meters.length > 0 ? fixedSharedPool / meters.length : 0;

    // 6. Rate Calculation (Corrected to ensure sum matches)
    // Rate = (Total Bill - Fixed Shared Pool) / Sum of Sub-meter Units
    // This distributes any "System Loss" across the energy rate
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
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  type AppView = 'home' | 'estimator' | 'history' | 'stats' | 'trends' | 'tenants' | 'tariff' | 'report';
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'none' | 'cloud'>('none');
  const [config, setConfig] = useState<BillConfig>(INITIAL_CONFIG);
  const [mainMeter, setMainMeter] = useState<MeterReading>(INITIAL_MAIN_METER);
  const [meters, setMeters] = useState<MeterReading[]>(INITIAL_METERS);
  const [history, setHistory] = useState<SavedBill[]>([]);
  const [tariffConfig, setTariffConfig] = useState<TariffConfig>(DEFAULT_TARIFF_CONFIG);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const lastCloudSyncTimestamp = useRef<number>(0);
  const isFirstRender = useRef(true);
  const isInternalChange = useRef(false);

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

  const fetchCloudData = useCallback(async () => {
    if (!spreadsheetService.isReady()) return;
    setIsInitialLoading(true);
    setIsSyncing(true);
    try {
      const [cloudDraft, cloudHistory, cloudTariff, cloudTenants] = await Promise.all([
        spreadsheetService.getDraft(),
        spreadsheetService.getBills(),
        spreadsheetService.getTariff(),
        spreadsheetService.getTenants()
      ]);
      if (cloudDraft) {
        isInternalChange.current = true; 
        setConfig(cloudDraft.config);
        setMainMeter(cloudDraft.mainMeter);
        setMeters(cloudDraft.meters);
        lastCloudSyncTimestamp.current = cloudDraft.updatedAt;
        localStorage.setItem('tmss_draft_config', JSON.stringify(cloudDraft.config));
        localStorage.setItem('tmss_draft_main_meter', JSON.stringify(cloudDraft.mainMeter));
        localStorage.setItem('tmss_draft_meters', JSON.stringify(cloudDraft.meters));
      }
      if (cloudHistory) { setHistory(sortBills(cloudHistory)); localStorage.setItem('tmss_bill_history', JSON.stringify(cloudHistory)); }
      if (cloudTariff) { setTariffConfig(cloudTariff); localStorage.setItem('tmss_tariff_config', JSON.stringify(cloudTariff)); }
      if (cloudTenants) { setTenants(cloudTenants); localStorage.setItem('tmss_tenants', JSON.stringify(cloudTenants)); }
      
      alert("Local data overwritten with cloud data!");
    } catch (error: any) { 
      console.error("Cloud fetch error", error);
      alert(`Pull failed: ${error.message || "Unknown error"}`);
    } finally { 
      setIsInitialLoading(false); 
      setIsSyncing(false); 
      setTimeout(() => { isInternalChange.current = false; }, 1000); 
    }
  }, []);

  const pushCloudData = useCallback(async () => {
    if (!spreadsheetService.isReady()) return;
    setIsSyncing(true);
    try {
      const now = Date.now();
      await spreadsheetService.saveDraft({ updatedAt: now, config, mainMeter, meters });
      await spreadsheetService.saveTariff(tariffConfig);
      await spreadsheetService.saveTenants(tenants);
      await spreadsheetService.saveHistory(history);
      
      lastCloudSyncTimestamp.current = now;
      alert("Cloud data overwritten with local data!");
    } catch (error: any) { 
      console.error("Cloud push error", error);
      alert(`Push failed: ${error.message || "Check network/script settings"}`); 
    } finally { 
      setIsSyncing(false); 
    }
  }, [config, mainMeter, meters, tariffConfig, tenants, history]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('tmss_bill_history');
    if (savedHistory) setHistory(sortBills(JSON.parse(savedHistory)));
    const savedTariff = localStorage.getItem('tmss_tariff_config');
    if (savedTariff) setTariffConfig(JSON.parse(savedTariff));
    const savedTenants = localStorage.getItem('tmss_tenants');
    if (savedTenants) setTenants(JSON.parse(savedTenants));
    const savedDraft = localStorage.getItem('tmss_draft_config');
    if (savedDraft) {
        setConfig(JSON.parse(savedDraft));
        const m = localStorage.getItem('tmss_draft_meters');
        if (m) setMeters(JSON.parse(m));
        const main = localStorage.getItem('tmss_draft_main_meter');
        if (main) setMainMeter(JSON.parse(main));
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (isInternalChange.current || isInitialLoading) return;
    localStorage.setItem('tmss_draft_config', JSON.stringify(config));
    localStorage.setItem('tmss_draft_main_meter', JSON.stringify(mainMeter));
    localStorage.setItem('tmss_draft_meters', JSON.stringify(meters));
    if (spreadsheetService.isReady()) {
        const timer = setTimeout(async () => {
            setIsSyncing(true);
            try { await spreadsheetService.saveDraft({ updatedAt: Date.now(), config, mainMeter, meters }); } catch (e) {} finally { setIsSyncing(false); }
        }, 2000); 
        return () => clearTimeout(timer);
    }
  }, [config, mainMeter, meters, isInitialLoading]);

  const handleViewChange = (view: AppView) => {
      setCurrentView(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTariffSave = async (newConfig: TariffConfig) => {
      setTariffConfig(newConfig);
      if (config.includeBkashFee) setConfig(prev => ({ ...prev, bkashFee: newConfig.bkashCharge }));
      localStorage.setItem('tmss_tariff_config', JSON.stringify(newConfig));
      if (spreadsheetService.isReady()) { setIsSyncing(true); try { await spreadsheetService.saveTariff(newConfig); } finally { setIsSyncing(false); } }
  };

  const handleTenantsUpdate = async (newTenants: Tenant[]) => {
      setTenants(newTenants);
      localStorage.setItem('tmss_tenants', JSON.stringify(newTenants));
      if (spreadsheetService.isReady()) { setIsSyncing(true); try { await spreadsheetService.saveTenants(newTenants); } finally { setIsSyncing(false); } }
  };

  const saveToHistory = async () => {
    const updatedConfig = { ...config, totalBillPayable: calculationResult.totalCollection };
    const newRecord: SavedBill = { id: Date.now().toString(), savedAt: new Date().toISOString(), config: updatedConfig, mainMeter: { ...mainMeter }, meters: [...meters] };
    const updatedHistory = sortBills([newRecord, ...history]);
    setHistory(updatedHistory);
    localStorage.setItem('tmss_bill_history', JSON.stringify(updatedHistory));
    if (spreadsheetService.isReady()) { setIsSyncing(true); try { await spreadsheetService.saveBill(newRecord); } finally { setIsSyncing(false); } }
    alert("Bill saved to history.");
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
      case 'home': return <Dashboard config={config} result={calculationResult} mainMeter={mainMeter} meters={meters} onUpdateMeters={setMeters} onMainMeterUpdate={setMainMeter} onConfigUpdate={setConfig} tenants={tenants} tariffConfig={tariffConfig} onSaveHistory={saveToHistory} />;
      case 'estimator': return <BillEstimator tariffConfig={tariffConfig} />;
      case 'history': return <BillHistory history={history} onLoad={loadFromHistory} onDelete={(id) => { if (window.confirm(t('confirm_delete'))) setHistory(history.filter(h => h.id !== id)); }} onViewReport={loadFromHistory} />;
      case 'stats': return <ConsumptionStats calculations={calculationResult.userCalculations} totalUnits={calculationResult.totalUnits} />;
      case 'trends': return <TrendsDashboard history={history} />;
      case 'tenants': return <TenantManager tenants={tenants} onUpdateTenants={handleTenantsUpdate} />;
      case 'tariff': return <TariffSettings config={tariffConfig} onSave={handleTariffSave} />;
      default: return null;
    }
  };

  const isCloudReady = spreadsheetService.isReady();

  const headerTitle = useMemo(() => {
    switch(currentView) {
      case 'estimator': return 'Electricity Bill Calculator';
      case 'home': return 'Bill Splitter';
      case 'history': return 'History';
      case 'tenants': return t('tenant_manager');
      case 'tariff': return t('tariff_settings');
      case 'trends': return t('trends_dashboard');
      case 'stats': return t('consumption_share');
      default: return 'Bill Splitter';
    }
  }, [currentView, t]);

  return (
    <div className="min-h-screen bg-transparent pb-safe transition-colors duration-500">
      <header className="sticky top-0 z-30 no-print pt-safe border-b border-white/10 bg-indigo-900 shadow-xl">
        <div className="px-5 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
              <button onClick={() => setIsMenuOpen(true)} className="p-2 text-white/90 hover:bg-white/10 rounded-2xl transition-all">
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white leading-none">{headerTitle}</h1>
              </div>
          </div>
            
          <div className="flex items-center gap-2">
            {currentView === 'home' && (
              <button onClick={() => { const m: MeterReading = { id: Date.now().toString(), name: '', meterNo: (meters.length+1).toString(), previous: 0, current: 0 }; setMeters([...meters, m]); }} className="p-3 text-white/90 hover:bg-white/10 rounded-2xl transition-all active:scale-90">
                <Plus className="w-6 h-6" />
              </button>
            )}
            <button onClick={saveToHistory} className="p-3 text-white/90 hover:bg-white/10 rounded-2xl transition-all active:scale-90">
              <Save className="w-6 h-6" />
            </button>
            <button onClick={isCloudReady ? pushCloudData : () => setActiveModal('cloud')} className="p-3 text-white/90 hover:bg-white/10 rounded-2xl transition-all active:scale-90">
              <RefreshCw className={`w-6 h-6 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
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
                <Lightbulb className="w-5 h-5 text-indigo-500" /> Home
              </button>
              <button onClick={() => { handleViewChange('stats'); setIsMenuOpen(false); }} className="w-full text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-4">
                <PieChart className="w-5 h-5 text-emerald-500" /> {t('consumption_share')}
              </button>
              <button onClick={() => { handleViewChange('trends'); setIsMenuOpen(false); }} className="w-full text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-4">
                <BarChart3 className="w-5 h-5 text-indigo-500" /> {t('trends')}
              </button>
              <div className="mx-6 my-2 border-t border-slate-100 dark:border-slate-800"></div>
              <button onClick={() => { handleViewChange('tenants'); setIsMenuOpen(false); }} className="w-full text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-4">
                <Users className="w-5 h-5 text-teal-500" /> {t('tenants')}
              </button>
              <button onClick={() => { handleViewChange('tariff'); setIsMenuOpen(false); }} className="w-full text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-4">
                <Settings className="w-5 h-5 text-slate-500" /> {t('settings')}
              </button>
              <button onClick={() => { setActiveModal('cloud'); setIsMenuOpen(false); }} className="w-full text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-4">
                <Cloud className="w-5 h-5 text-indigo-500" /> {t('cloud_setup')}
              </button>
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button onClick={toggleTheme} className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-90 transition-all">
                {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">v1.2.0</span>
            </div>
          </div>
        </>
      )}

      <main className="max-w-3xl mx-auto px-5 py-6 print:p-0 pb-32 relative">
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
