
import React, { useState, useRef } from 'react';
import { BillCalculationResult, BillConfig, MeterReading, Tenant, TariffConfig, Slab } from '../types';
import { useLanguage } from '../i18n';
import { CreditCard, Clock, Calculator, Plus, Trash2, ChevronUp, Save, Zap, ShieldAlert, X, Image as ImageIcon, Share2, Loader2 } from 'lucide-react';
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

  const captureCanvas = async (scale = 3) => {
    if (!resultsRef.current) return null;
    
    // Create a temporary container to render the light-mode version for the image
    const element = resultsRef.current;
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Force some styles for the capture
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '450px'; 
    container.style.padding = '20px';
    container.style.backgroundColor = '#f8fafc'; // light slate bg
    
    // Remove no-print items from clone
    const noPrintItems = clone.querySelectorAll('.no-capture');
    noPrintItems.forEach(el => el.remove());
    
    // Ensure text is dark for the image
    clone.classList.remove('dark');
    const allDark = clone.querySelectorAll('.dark');
    allDark.forEach(el => el.classList.remove('dark'));
    
    container.appendChild(clone);
    document.body.appendChild(container);

    // Wait for any layout shifts
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const canvas = await html2canvas(clone, {
      scale: scale, 
      backgroundColor: '#f8fafc',
      logging: false,
      useCORS: true,
      width: 450
    });
    
    document.body.removeChild(container);
    return canvas;
  };

  const handleSaveImage = async () => {
    try {
      setIsGeneratingImage(true);
      const canvas = await captureCanvas();
      if (!canvas) return;
      
      const image = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.href = image;
      link.download = `Bill-Split-${config.month}-${new Date().getTime()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to generate image", error);
      alert("Failed to save image. Please try again.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleShareImage = async () => {
    try {
      setIsSharing(true);
      const canvas = await captureCanvas();
      if (!canvas) return;
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `Bill-${config.month}.png`, { type: 'image/png' });
        
        if (navigator.share) {
          try {
            await navigator.share({
              files: [file],
              title: `Electricity Bill Split - ${config.month}`,
              text: `Detailed split for ${translateMonth(config.month)} Bill.`
            });
          } catch (err) {
            console.log("Sharing cancelled or failed", err);
          }
        } else {
          // Fallback to download if sharing is not supported
          handleSaveImage();
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

  return (
    <div className="space-y-6 pb-32 animate-in fade-in duration-500 max-w-2xl mx-auto">
      
      {/* Main Meter Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Main Meter</h3>
        
        <div className="space-y-4">
          <div className="relative border border-slate-200 dark:border-slate-700 rounded-lg p-3 cursor-pointer">
            <label className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bill Date</label>
            <div className="flex justify-between items-center h-10">
              <span className="text-slate-700 dark:text-slate-200">{formatDateLocalized(config.dateGenerated)}</span>
              <input 
                type="date" 
                value={config.dateGenerated}
                onChange={(e) => { handleConfigChange('dateGenerated', e.target.value); setShowResult(false); }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" 
              />
              <Clock className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <label className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Previous Reading</label>
              <input 
                type="number"
                value={mainMeter.previous || ''}
                onChange={(e) => { handleMainMeterChange('previous', parseFloat(e.target.value) || 0); setShowResult(false); }}
                onFocus={(e) => e.target.select()}
                className="w-full h-10 bg-transparent text-slate-900 dark:text-white outline-none font-medium"
                placeholder=""
              />
            </div>
            <div className="relative border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <label className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Reading</label>
              <input 
                type="number"
                value={mainMeter.current || ''}
                onChange={(e) => { handleMainMeterChange('current', parseFloat(e.target.value) || 0); setShowResult(false); }}
                onFocus={(e) => e.target.select()}
                className="w-full h-10 bg-transparent text-slate-900 dark:text-white outline-none font-medium"
                placeholder=""
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bill Options Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CreditCard className="w-6 h-6 text-slate-700 dark:text-slate-400" />
            <span className="text-base font-semibold text-slate-700 dark:text-slate-200">Include bKash Fee</span>
          </div>
          <button 
            onClick={() => { handleConfigChange('includeBkashFee', !config.includeBkashFee); setShowResult(false); }}
            className={`w-12 h-6 rounded-full transition-colors relative ${config.includeBkashFee ? 'bg-indigo-900' : 'bg-slate-300'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${config.includeBkashFee ? 'left-7' : 'left-1'}`}></div>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Clock className="w-6 h-6 text-slate-700 dark:text-slate-400" />
            <span className="text-base font-semibold text-slate-700 dark:text-slate-200">Include Late Fee</span>
          </div>
          <button 
            onClick={() => { handleConfigChange('includeLateFee', !config.includeLateFee); setShowResult(false); }}
            className={`w-12 h-6 rounded-full transition-colors relative ${config.includeLateFee ? 'bg-indigo-900' : 'bg-slate-300'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${config.includeLateFee ? 'left-7' : 'left-1'}`}></div>
          </button>
        </div>
      </div>

      {/* Sub-meters List */}
      <div className="space-y-6">
        {meters.map((meter, index) => (
          <div 
            key={meter.id} 
            onMouseDown={() => startLongPress(meter)}
            onMouseUp={endLongPress}
            onMouseLeave={endLongPress}
            onTouchStart={() => startLongPress(meter)}
            onTouchEnd={endLongPress}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 relative transition-transform active:scale-[0.98] select-none"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-bold text-slate-800 dark:text-white uppercase tracking-tight">Sub-meter {index + 1}</h3>
            </div>

            <div className="space-y-4">
              <div className="relative border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <label className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</label>
                <input 
                  type="text"
                  value={meter.name}
                  onChange={(e) => { handleMeterChange(meter.id, 'name', e.target.value); setShowResult(false); }}
                  onFocus={(e) => e.target.select()}
                  className="w-full h-10 bg-transparent text-slate-900 dark:text-white outline-none font-medium"
                  placeholder=""
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <label className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Previous Reading</label>
                  <input 
                    type="number"
                    value={meter.previous || ''}
                    onChange={(e) => { handleMeterChange(meter.id, 'previous', parseFloat(e.target.value) || 0); setShowResult(false); }}
                    onFocus={(e) => e.target.select()}
                    className="w-full h-10 bg-transparent text-slate-900 dark:text-white outline-none font-medium"
                    placeholder=""
                  />
                </div>
                <div className="relative border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <label className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Reading</label>
                  <input 
                    type="number"
                    value={meter.current || ''}
                    onChange={(e) => { handleMeterChange(meter.id, 'current', parseFloat(e.target.value) || 0); setShowResult(false); }}
                    onFocus={(e) => e.target.select()}
                    className="w-full h-10 bg-transparent text-slate-900 dark:text-white outline-none font-medium"
                    placeholder=""
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {meterToDelete && (
        <div 
          onClick={() => setMeterToDelete(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-rose-500/20 animate-in slide-in-from-bottom-4 relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20 shadow-inner">
                     <ShieldAlert className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Security Check</h3>
                </div>
                <button onClick={() => setMeterToDelete(null)} className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl active:scale-90 transition-all">
                    <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-center">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                    Type <span className="text-rose-500 font-black">DELETE</span> to confirm removal of <span className="font-black underline">{meterToDelete.name || 'this sub-meter'}</span>.
                  </p>
                  
                  <div className="relative">
                    <input 
                      type="text"
                      autoFocus
                      placeholder="DELETE"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="w-full h-16 rounded-xl bg-white dark:bg-slate-950 border border-rose-500/20 px-4 text-center text-lg font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-slate-200 dark:placeholder:text-slate-800"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    disabled={confirmText.toUpperCase() !== 'DELETE'}
                    onClick={handleConfirmDelete}
                    className={`w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                      confirmText.toUpperCase() === 'DELETE'
                        ? 'bg-rose-600 text-white shadow-xl shadow-rose-500/30 active:scale-95'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <Trash2 className="w-5 h-5" /> Confirm Removal
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!showResult && (
        <button 
          onClick={() => setShowResult(true)}
          className="w-full h-16 bg-indigo-900 text-white rounded-2xl font-bold text-base shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <Calculator className="w-5 h-5" /> Calculate Split Bill
        </button>
      )}

      {/* Bill Results Sections */}
      {showResult && (
        <div ref={resultsRef} className="space-y-4 animate-in slide-in-from-bottom-6 duration-500 no-print pb-20 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2 no-capture">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Calculation Result</h2>
            <button onClick={() => setShowResult(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
              <ChevronUp className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* 1. Summary Section */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
             <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{translateMonth(config.month)} Bill</h3>
             
             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Date</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">{formatDateLocalized(config.dateGenerated)}</span>
             </div>

             <div className="space-y-1">
                <div className="flex justify-between items-center">
                   <span className="text-sm text-slate-500 font-medium">Total Bill Payable</span>
                   <span className="text-base font-black text-slate-900 dark:text-white">৳{formatNumber(result.totalCollection.toFixed(2))}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-bold text-center italic bg-slate-50 dark:bg-slate-800/50 py-2 rounded-xl">
                   (Base Bill: ৳{formatNumber(baseBill.toFixed(2))} + Late Fee: ৳{formatNumber(result.lateFee.toFixed(2))} + bKash Fee: ৳{formatNumber(bkash.toFixed(2))})
                </div>
             </div>

             <div className="flex justify-between items-center text-sm pt-2">
                <span className="text-slate-500 font-medium">Total Units (Main)</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">
                   ({formatNumber(mainMeter.current.toFixed(2))} - {formatNumber(mainMeter.previous.toFixed(2))}) = {formatNumber(mainUnits.toFixed(2))} kWh
                </span>
             </div>

             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Total User Units</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">{formatNumber(result.totalUnits.toFixed(2))} kWh</span>
             </div>

             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Calculated Rate/Unit (Energy)</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">৳{formatNumber(result.calculatedRate.toFixed(2))}</span>
             </div>
          </div>

          {/* 2. Cost Configuration Section */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
             <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Cost Configuration</h3>
             
             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Demand Charge</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">৳{formatNumber(tariffConfig.demandCharge.toFixed(2))}</span>
             </div>

             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Meter Rent</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">৳{formatNumber(tariffConfig.meterRent.toFixed(2))}</span>
             </div>

             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">VAT (Fixed - 5.0% on DC+Rent)</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">৳{formatNumber(result.vatFixed.toFixed(2))}</span>
             </div>

             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Total VAT</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">৳{formatNumber(result.vatTotal.toFixed(2))}</span>
             </div>

             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Late Fee</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">৳{formatNumber(result.lateFee.toFixed(2))}</span>
             </div>

             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">bKash Fee</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">৳{formatNumber(bkash.toFixed(2))}</span>
             </div>

             <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"></div>

             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400 font-bold">Total Shared Fixed Costs</span>
                <span className="text-slate-900 dark:text-white font-black">৳{formatNumber(totalSharedFixedCosts.toFixed(2))}</span>
             </div>

             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400 font-bold">Fixed Cost Per User</span>
                <span className="text-slate-900 dark:text-white font-black">৳{formatNumber(fixedPerUser.toFixed(2))}</span>
          </div>
        </div>

          {/* 3. Individual Bills Section */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
             <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Individual Bills</h3>
             
             <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-xl">
               <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                     <tr className="text-slate-500 font-bold text-xs uppercase">
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3 text-right">Units</th>
                        <th className="px-4 py-3 text-right">Bill</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                     {result.userCalculations.map((user) => (
                        <tr key={user.id}>
                           <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{user.name || 'User'}</td>
                           <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 font-mono">
                              ({formatNumber(user.current.toFixed(2))} - {formatNumber(user.previous.toFixed(2))}) = {formatNumber(user.unitsUsed.toFixed(2))}
                           </td>
                           <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white font-mono">৳{formatNumber(Math.round(user.totalPayable))}</td>
                        </tr>
                     ))}
                     <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                        <td colSpan={2} className="px-4 py-4 text-right font-black uppercase tracking-widest text-[10px] text-slate-400">Total Collection</td>
                        <td className="px-4 py-4 text-right font-black text-indigo-900 dark:text-indigo-400 text-lg">৳{formatNumber(Math.round(result.totalCollection))}</td>
                     </tr>
                  </tbody>
               </table>
             </div>

             <div className="grid grid-cols-2 gap-3 no-capture">
                <button 
                   onClick={handleSaveImage}
                   disabled={isGeneratingImage}
                   className="w-full h-14 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 text-sm shadow-lg active:scale-95 transition-all"
                >
                   {isGeneratingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                   Save PNG
                </button>
                <button 
                   onClick={handleShareImage}
                   disabled={isSharing}
                   className="w-full h-14 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 text-sm shadow-lg active:scale-95 transition-all"
                >
                   {isSharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
                   Share Bill
                </button>
             </div>

             <button 
                onClick={onSaveHistory}
                className="w-full h-14 bg-slate-900 dark:bg-indigo-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 text-sm shadow-xl active:scale-95 transition-all mt-2 no-capture"
             >
                <Save className="w-5 h-5" /> Save to History
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
