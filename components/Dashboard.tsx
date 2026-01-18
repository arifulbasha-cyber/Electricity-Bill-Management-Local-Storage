
import React, { useState, useRef } from 'react';
import { BillCalculationResult, BillConfig, MeterReading, Tenant, TariffConfig } from '../types';
import { useLanguage } from '../i18n';
import { CreditCard, Clock, Calculator, ChevronUp, Save, Zap, ShieldAlert, X, Image as ImageIcon, Share2, Loader2, Download, Smartphone, Trash2 } from 'lucide-react';
import html2canvas from 'html2canvas';

interface DashboardProps {
  config: BillConfig;
  result: BillCalculationResult;
  mainMeter: MeterReading;
  meters: MeterReading[];
  onUpdateMeters: (meters: MeterReading[]) => void;
  onMainMeterUpdate: (reading: MeterReading) => void;
  onConfigUpdate: (config: BillConfig) => void;
  tenants: Tenant[];
  tariffConfig: TariffConfig;
  onSaveHistory?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ config, result, mainMeter, meters, onUpdateMeters, onMainMeterUpdate, onConfigUpdate, tenants, tariffConfig, onSaveHistory }) => {
  const { t, formatNumber, formatDateLocalized, translateMonth } = useLanguage();
  const [showResult, setShowResult] = useState(false);
  const [meterToDelete, setMeterToDelete] = useState<MeterReading | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const resultsRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const handleMainMeterChange = (key: keyof MeterReading, value: any) => {
    onMainMeterUpdate({ ...mainMeter, [key]: value });
  };

  const handleMeterChange = (id: string, key: keyof MeterReading, value: any) => {
    onUpdateMeters(meters.map(m => m.id === id ? { ...m, [key]: value } : m));
  };

  const handleConfigChange = (key: keyof BillConfig, value: any) => {
    onConfigUpdate({ ...config, [key]: value });
  };

  const startLongPress = (meter: MeterReading) => {
    longPressTimerRef.current = window.setTimeout(() => {
      setMeterToDelete(meter);
      setConfirmText('');
      if ('vibrate' in navigator) navigator.vibrate(50);
    }, 800);
  };

  const endLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleConfirmDelete = () => {
    if (meterToDelete && confirmText.toUpperCase() === 'DELETE') {
      onUpdateMeters(meters.filter(m => m.id !== meterToDelete.id));
      setMeterToDelete(null);
      setShowResult(false);
    }
  };

  const captureCanvas = async (scale = 2) => {
    if (!resultsRef.current) return null;
    
    const element = resultsRef.current;
    const clone = element.cloneNode(true) as HTMLElement;
    
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '480px'; 
    container.style.padding = '30px 20px'; 
    container.style.backgroundColor = '#f8fafc'; 
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    
    const noPrintItems = clone.querySelectorAll('.no-capture');
    noPrintItems.forEach(el => el.remove());
    
    clone.classList.remove('dark', 'max-w-2xl', 'mx-auto');
    clone.style.width = '100%';
    clone.style.maxWidth = '440px'; 
    clone.style.margin = '0';
    
    const allDark = clone.querySelectorAll('.dark');
    allDark.forEach(el => el.classList.remove('dark'));

    const unitCells = clone.querySelectorAll('td.font-mono');
    unitCells.forEach(cell => {
      (cell as HTMLElement).style.whiteSpace = 'nowrap';
    });
    
    container.appendChild(clone);
    document.body.appendChild(container);

    await new Promise(resolve => setTimeout(resolve, 300));
    
    const canvas = await html2canvas(container, {
      scale: scale, 
      backgroundColor: '#f8fafc',
      logging: false,
      useCORS: true,
      allowTaint: true,
      width: 480,
    });
    
    document.body.removeChild(container);
    return canvas;
  };

  const handleSaveImage = async () => {
    try {
      setIsGeneratingImage(true);
      const canvas = await captureCanvas(2);
      if (!canvas) return;
      
      const image = canvas.toDataURL("image/png");
      setPreviewImage(image);
    } catch (error) {
      console.error("Failed to generate image", error);
      alert("Failed to generate image preview.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleShareImage = async () => {
    try {
      setIsSharing(true);
      const canvas = await captureCanvas(2);
      if (!canvas) return;
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `Bill-${config.month}.png`, { type: 'image/png' });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Bill Split - ${config.month}`,
              text: `Electricity Bill Split for ${translateMonth(config.month)}.`
            });
          } catch (err) {
            console.log("Sharing failed", err);
          }
        } else {
          setPreviewImage(canvas.toDataURL("image/png"));
        }
      });
    } catch (error) {
      console.error("Failed to share", error);
    } finally {
      setIsSharing(false);
    }
  };

  const mainUnits = Math.max(0, mainMeter.current - mainMeter.previous);
  const bkash = config.includeBkashFee ? tariffConfig.bkashCharge : 0;
  const baseBill = result.totalCollection - result.lateFee - bkash;
  const totalSharedFixedCosts = tariffConfig.demandCharge + tariffConfig.meterRent + result.vatFixed + result.lateFee + bkash;
  const fixedPerUser = meters.length > 0 ? totalSharedFixedCosts / meters.length : 0;
  const billYear = config.dateGenerated.split('-')[0].slice(-2);

  return (
    <div className="space-y-3 pb-32 animate-in fade-in duration-500 max-w-2xl mx-auto">
      
      {/* Main Meter Card - Reduced Padding/Spacing */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Main Meter</h3>
          <span className="text-[10px] font-bold text-emerald-500 uppercase">{mainUnits} Units used</span>
        </div>
        
        <div className="space-y-3">
          <div className="relative border border-slate-200 dark:border-slate-700 rounded-lg p-2 cursor-pointer h-10 flex items-center">
            <label className="absolute -top-2 left-2 bg-white dark:bg-slate-900 px-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">Bill Date</label>
            <div className="flex justify-between items-center w-full">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{formatDateLocalized(config.dateGenerated)}</span>
              <input 
                type="date" 
                value={config.dateGenerated}
                onChange={(e) => { handleConfigChange('dateGenerated', e.target.value); setShowResult(false); }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" 
              />
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="relative border border-slate-200 dark:border-slate-700 rounded-lg p-2 h-10 flex items-center">
              <label className="absolute -top-2 left-2 bg-white dark:bg-slate-900 px-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">Previous</label>
              <input 
                type="number"
                value={mainMeter.previous || ''}
                onChange={(e) => { handleMainMeterChange('previous', parseFloat(e.target.value) || 0); setShowResult(false); }}
                onFocus={(e) => e.target.select()}
                className="w-full bg-transparent text-sm font-bold text-slate-900 dark:text-white outline-none"
                placeholder=""
              />
            </div>
            <div className="relative border border-slate-200 dark:border-slate-700 rounded-lg p-2 h-10 flex items-center">
              <label className="absolute -top-2 left-2 bg-white dark:bg-slate-900 px-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">Current</label>
              <input 
                type="number"
                value={mainMeter.current || ''}
                onChange={(e) => { handleMainMeterChange('current', parseFloat(e.target.value) || 0); setShowResult(false); }}
                onFocus={(e) => e.target.select()}
                className="w-full bg-transparent text-sm font-bold text-slate-900 dark:text-white outline-none"
                placeholder=""
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bill Options Card - More Compact */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
        <div className="flex-1 flex items-center justify-between border-r border-slate-100 dark:border-slate-800 pr-4">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">bKash Fee</span>
          <button 
            onClick={() => { handleConfigChange('includeBkashFee', !config.includeBkashFee); setShowResult(false); }}
            className={`w-10 h-5 rounded-full transition-colors relative ${config.includeBkashFee ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.includeBkashFee ? 'left-5.5' : 'left-0.5'}`}></div>
          </button>
        </div>

        <div className="flex-1 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Late Fee</span>
          <button 
            onClick={() => { handleConfigChange('includeLateFee', !config.includeLateFee); setShowResult(false); }}
            className={`w-10 h-5 rounded-full transition-colors relative ${config.includeLateFee ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.includeLateFee ? 'left-5.5' : 'left-0.5'}`}></div>
          </button>
        </div>
      </div>

      {/* Sub-meters List - Compact Table-like Rows */}
      <div className="space-y-2">
        {meters.map((meter, index) => {
          const units = Math.max(0, meter.current - meter.previous);
          return (
            <div 
              key={meter.id} 
              onMouseDown={() => startLongPress(meter)}
              onMouseUp={endLongPress}
              onMouseLeave={endLongPress}
              onTouchStart={() => startLongPress(meter)}
              onTouchEnd={endLongPress}
              className="bg-white dark:bg-slate-900 rounded-xl p-2.5 shadow-sm border border-slate-100 dark:border-slate-800 relative transition-transform active:scale-[0.99] select-none"
            >
              <div className="flex items-center gap-3">
                <div className="flex-none w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-black text-indigo-600">{index + 1}</span>
                </div>
                
                <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5 relative">
                    <label className="absolute -top-2 left-1 px-1 bg-white dark:bg-slate-900 text-[7px] font-black text-slate-400 uppercase">User Name</label>
                    <input 
                      type="text"
                      value={meter.name}
                      onChange={(e) => { handleMeterChange(meter.id, 'name', e.target.value); setShowResult(false); }}
                      onFocus={(e) => e.target.select()}
                      className="w-full h-8 bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none border-b border-slate-100 dark:border-slate-800 focus:border-indigo-500"
                      placeholder="Name"
                    />
                  </div>
                  
                  <div className="col-span-3 relative">
                    <label className="absolute -top-2 left-1 px-1 bg-white dark:bg-slate-900 text-[7px] font-black text-slate-400 uppercase tracking-tighter">Prev</label>
                    <input 
                      type="number"
                      value={meter.previous || ''}
                      onChange={(e) => { handleMeterChange(meter.id, 'previous', parseFloat(e.target.value) || 0); setShowResult(false); }}
                      onFocus={(e) => e.target.select()}
                      className="w-full h-8 bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none border-b border-slate-100 dark:border-slate-800 focus:border-indigo-500 text-center"
                    />
                  </div>

                  <div className="col-span-3 relative">
                    <label className="absolute -top-2 left-1 px-1 bg-white dark:bg-slate-900 text-[7px] font-black text-emerald-500 uppercase tracking-tighter">Curr</label>
                    <input 
                      type="number"
                      value={meter.current || ''}
                      onChange={(e) => { handleMeterChange(meter.id, 'current', parseFloat(e.target.value) || 0); setShowResult(false); }}
                      onFocus={(e) => e.target.select()}
                      className="w-full h-8 bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none border-b border-slate-100 dark:border-slate-800 focus:border-indigo-500 text-center"
                    />
                  </div>

                  <div className="col-span-1 text-right flex flex-col justify-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase block">Units</span>
                    <span className="text-[10px] font-black text-indigo-600">{units}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals and Results remain but results UI is also compacted */}
      {meterToDelete && (
        <div 
          onClick={() => setMeterToDelete(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-rose-500/20"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                   <ShieldAlert className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase">Security Check</h3>
              </div>
              <button onClick={() => setMeterToDelete(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 text-center">
                Type <span className="text-rose-500 font-black">DELETE</span> to confirm removal.
              </p>
              <input 
                type="text"
                autoFocus
                placeholder="DELETE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full h-12 rounded-xl bg-slate-50 dark:bg-slate-950 border border-rose-500/10 text-center text-sm font-black outline-none"
              />
              <button 
                disabled={confirmText.toUpperCase() !== 'DELETE'}
                onClick={handleConfirmDelete}
                className="w-full h-12 rounded-xl bg-rose-600 text-white font-black text-xs uppercase tracking-widest disabled:opacity-50"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[110] flex flex-col items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300"
        >
          <div className="w-full max-w-md flex flex-col gap-3">
             <div className="flex justify-between items-center text-white">
                <span className="text-xs font-bold">Preview Bill Image</span>
                <button onClick={() => setPreviewImage(null)} className="p-1.5 bg-white/10 rounded-full">
                   <X className="w-5 h-5" />
                </button>
             </div>
             <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
                <img src={previewImage} alt="Bill Preview" className="w-full h-auto" />
             </div>
             <div className="bg-indigo-500/20 p-3 rounded-xl text-center">
                <p className="text-white text-[10px] font-bold">
                   <Download className="w-3 h-3 inline mr-1" /> Long press image to save.
                </p>
             </div>
          </div>
        </div>
      )}

      {!showResult && (
        <button 
          onClick={() => setShowResult(true)}
          className="w-full h-14 bg-indigo-900 text-white rounded-xl font-bold text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Calculator className="w-4 h-4" /> Calculate Split Bill
        </button>
      )}

      {showResult && (
        <div ref={resultsRef} className="space-y-3 animate-in slide-in-from-bottom-6 duration-500 no-print pb-20 max-w-2xl mx-auto">
          <div className="flex items-center justify-between no-capture">
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Calculation Result</h2>
            <button onClick={() => setShowResult(false)} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <ChevronUp className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
             <h3 className="text-sm font-black text-slate-800 dark:text-white border-b border-slate-50 pb-2">{translateMonth(config.month)} {billYear}</h3>
             
             <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                <span className="text-slate-500 font-bold">Total Bill Payable</span>
                <span className="text-right text-slate-900 dark:text-white font-black">৳{formatNumber(result.totalCollection.toFixed(2))}</span>
                
                <span className="text-slate-500 font-bold">Total Units (Main)</span>
                <span className="text-right text-slate-800 dark:text-slate-200 font-bold">{formatNumber(mainUnits.toFixed(2))} kWh</span>
                
                <span className="text-slate-500 font-bold">Calculated Rate/Unit</span>
                <span className="text-right text-slate-800 dark:text-slate-200 font-bold">৳{formatNumber(result.calculatedRate.toFixed(3))}</span>
             </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
             <h3 className="text-xs font-black text-slate-800 dark:text-white mb-3 uppercase">Individual Split</h3>
             <div className="overflow-hidden border border-slate-50 dark:border-slate-800 rounded-lg">
               <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                     <tr className="text-slate-500 font-black uppercase">
                        <th className="px-3 py-2">User</th>
                        <th className="px-3 py-2 text-right">Units</th>
                        <th className="px-3 py-2 text-right">Bill</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                     {result.userCalculations.map((user) => (
                        <tr key={user.id}>
                           <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300">{user.name}</td>
                           <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400 font-mono">{formatNumber(user.unitsUsed.toFixed(1))}</td>
                           <td className="px-3 py-2 text-right font-black text-slate-900 dark:text-white">৳{formatNumber(Math.round(user.totalPayable))}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
             </div>

             <div className="grid grid-cols-2 gap-2 no-capture mt-4">
                <button onClick={handleSaveImage} className="w-full h-10 bg-emerald-600 text-white rounded-lg font-bold flex items-center justify-center gap-1 text-[10px] uppercase shadow-md">
                   {isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />} Preview
                </button>
                <button onClick={handleShareImage} className="w-full h-10 bg-indigo-600 text-white rounded-lg font-bold flex items-center justify-center gap-1 text-[10px] uppercase shadow-md">
                   {isSharing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />} Share
                </button>
             </div>

             <button 
                onClick={onSaveHistory}
                className="w-full h-10 bg-slate-900 dark:bg-indigo-900 text-white rounded-lg font-bold flex items-center justify-center gap-1 text-[10px] uppercase mt-2 no-capture shadow-md"
             >
                <Save className="w-3 h-3" /> Save to History
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
