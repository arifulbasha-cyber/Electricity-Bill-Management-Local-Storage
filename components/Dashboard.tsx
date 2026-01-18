
import React, { useState, useRef, useMemo } from 'react';
import { BillCalculationResult, BillConfig, MeterReading, Tenant, TariffConfig } from '../types';
import { useLanguage } from '../i18n';
import { Calculator, ChevronUp, Save, ShieldAlert, X, Image as ImageIcon, Share2, Loader2, Download, Clock, Info, Activity } from 'lucide-react';
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
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  
  const resultsRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const mainUnits = Math.max(0, mainMeter.current - mainMeter.previous);
  const totalSubUnits = useMemo(() => meters.reduce((acc, m) => acc + Math.max(0, m.current - m.previous), 0), [meters]);
  const systemLoss = Math.max(0, mainUnits - totalSubUnits);

  const bkashFee = config.includeBkashFee ? tariffConfig.bkashCharge : 0;
  const baseBill = result.totalCollection - result.lateFee - bkashFee;
  const totalSharedFixedCosts = tariffConfig.demandCharge + tariffConfig.meterRent + result.vatFixed + result.lateFee + bkashFee;
  const fixedCostPerUser = meters.length > 0 ? totalSharedFixedCosts / meters.length : 0;

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
    
    // Setup capture container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '420px'; 
    container.style.padding = '24px 16px'; 
    container.style.backgroundColor = '#f1f5f9'; 
    
    const clone = resultsRef.current.cloneNode(true) as HTMLElement;
    const noPrintItems = clone.querySelectorAll('.no-capture');
    noPrintItems.forEach(el => el.remove());
    
    clone.classList.remove('dark');
    const allDark = clone.querySelectorAll('.dark');
    allDark.forEach(el => el.classList.remove('dark'));
    
    container.appendChild(clone);
    document.body.appendChild(container);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const canvas = await html2canvas(container, {
      scale,
      backgroundColor: '#f1f5f9',
      width: 420,
      useCORS: true,
      logging: false
    });
    
    document.body.removeChild(container);
    return canvas;
  };

  const handleSavePreview = async () => {
    try {
      setIsGeneratingImage(true);
      const canvas = await captureCanvas(3);
      if (canvas) {
        setPreviewImage(canvas.toDataURL("image/png"));
        canvas.toBlob((blob) => {
          if (blob) setPreviewBlob(blob);
        }, "image/png");
      }
    } catch (e) { 
      alert("Failed to generate report image."); 
    } finally { 
      setIsGeneratingImage(false); 
    }
  };

  const downloadImage = () => {
    if (!previewBlob) return;
    const url = URL.createObjectURL(previewBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bill-${config.month}-${new Date().getTime()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleShareImage = async () => {
    try {
      setIsSharing(true);
      const canvas = await captureCanvas(3);
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `Bill-${config.month}.png`, { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Bill Split`, text: `Bill for ${config.month}` });
        } else { 
          setPreviewImage(canvas.toDataURL("image/png")); 
          setPreviewBlob(blob);
        }
      });
    } catch (e) {} finally { setIsSharing(false); }
  };

  const billYear = config.dateGenerated.split('-')[0].slice(-2);

  return (
    <div className="space-y-3 pb-32 max-w-2xl mx-auto">
      
      {/* Entry Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Data Entry</h3>
          <span className="text-[10px] font-black text-emerald-500 uppercase">{formatNumber(mainUnits)} kWh Main</span>
        </div>
        <div className="grid grid-cols-12 gap-2">
           <div className="col-span-4 relative border border-slate-100 dark:border-slate-800 rounded-lg p-1.5 h-10 flex items-center bg-slate-50 dark:bg-slate-950">
             <label className="absolute -top-1.5 left-2 bg-white dark:bg-slate-900 px-1 text-[7px] font-black text-slate-400 uppercase tracking-widest">Date</label>
             <input type="date" value={config.dateGenerated} onChange={(e) => { handleConfigChange('dateGenerated', e.target.value); setShowResult(false); }} className="w-full bg-transparent text-[11px] font-bold outline-none" />
           </div>
           <div className="col-span-4 relative border border-slate-100 dark:border-slate-800 rounded-lg p-1.5 h-10 flex items-center bg-slate-50 dark:bg-slate-950">
             <label className="absolute -top-1.5 left-2 bg-white dark:bg-slate-900 px-1 text-[7px] font-black text-slate-400 uppercase tracking-widest">Previous</label>
             <input type="number" value={mainMeter.previous || ''} onChange={(e) => { handleMainMeterChange('previous', parseFloat(e.target.value) || 0); setShowResult(false); }} className="w-full bg-transparent text-[11px] font-bold outline-none" />
           </div>
           <div className="col-span-4 relative border border-slate-100 dark:border-slate-800 rounded-lg p-1.5 h-10 flex items-center bg-slate-50 dark:bg-slate-950">
             <label className="absolute -top-1.5 left-2 bg-white dark:bg-slate-900 px-1 text-[7px] font-black text-emerald-500 uppercase tracking-widest">Current</label>
             <input type="number" value={mainMeter.current || ''} onChange={(e) => { handleMainMeterChange('current', parseFloat(e.target.value) || 0); setShowResult(false); }} className="w-full bg-transparent text-[11px] font-bold outline-none" />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => { handleConfigChange('includeBkashFee', !config.includeBkashFee); setShowResult(false); }} className={`h-11 rounded-xl px-4 flex items-center justify-between border ${config.includeBkashFee ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400'}`}>
           <span className="text-[9px] font-black uppercase">bKash</span>
           <div className={`w-7 h-4 rounded-full relative transition-colors ${config.includeBkashFee ? 'bg-white/30' : 'bg-slate-200'}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${config.includeBkashFee ? 'left-3.5' : 'left-0.5'}`}></div>
           </div>
        </button>
        <button onClick={() => { handleConfigChange('includeLateFee', !config.includeLateFee); setShowResult(false); }} className={`h-11 rounded-xl px-4 flex items-center justify-between border ${config.includeLateFee ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400'}`}>
           <span className="text-[9px] font-black uppercase">Late Fee</span>
           <div className={`w-7 h-4 rounded-full relative transition-colors ${config.includeLateFee ? 'bg-white/30' : 'bg-slate-200'}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${config.includeLateFee ? 'left-3.5' : 'left-0.5'}`}></div>
           </div>
        </button>
      </div>

      <div className="space-y-1.5">
        {meters.map((meter, index) => (
          <div key={meter.id} onMouseDown={() => startLongPress(meter)} onMouseUp={endLongPress} onTouchStart={() => startLongPress(meter)} onTouchEnd={endLongPress} className="bg-white dark:bg-slate-900 rounded-xl p-2.5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <span className="w-7 h-7 rounded bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-indigo-600">{index+1}</span>
            <div className="flex-1 grid grid-cols-12 gap-2 items-center">
              <input type="text" value={meter.name} onChange={(e) => { handleMeterChange(meter.id, 'name', e.target.value); setShowResult(false); }} className="col-span-4 h-9 bg-transparent text-xs font-bold outline-none border-b border-slate-50 dark:border-slate-800" placeholder="User" />
              <div className="col-span-3 relative h-9 flex items-center border-b border-slate-50 dark:border-slate-800">
                <label className="absolute -top-1.5 left-0 text-[7px] font-black text-slate-400 uppercase">Prev</label>
                <input type="number" value={meter.previous || ''} onChange={(e) => { handleMeterChange(meter.id, 'previous', parseFloat(e.target.value) || 0); setShowResult(false); }} className="w-full bg-transparent text-xs font-bold outline-none text-center" />
              </div>
              <div className="col-span-3 relative h-9 flex items-center border-b border-slate-50 dark:border-slate-800">
                <label className="absolute -top-1.5 left-0 text-[7px] font-black text-emerald-500 uppercase">Curr</label>
                <input type="number" value={meter.current || ''} onChange={(e) => { handleMeterChange(meter.id, 'current', parseFloat(e.target.value) || 0); setShowResult(false); }} className="w-full bg-transparent text-xs font-bold outline-none text-center" />
              </div>
              <div className="col-span-2 text-right">
                <span className="text-[7px] block font-black text-slate-400 uppercase leading-none">Units</span>
                <span className="text-xs font-black text-indigo-600">{formatNumber(Math.max(0, meter.current - meter.previous))}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!showResult && (
        <button onClick={() => { setShowResult(true); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }} className="w-full h-14 bg-indigo-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 mt-4">
          <Calculator className="w-5 h-5" /> Calculate Split Bill
        </button>
      )}

      {/* High Fidelity Report UI */}
      {showResult && (
        <div ref={resultsRef} className="space-y-4 animate-in slide-in-from-bottom-6 duration-500 pb-20">
          
          <div className="no-capture flex justify-between items-center px-2 pt-6 mb-2">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Calculation Result</h2>
            <button onClick={() => setShowResult(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl"><ChevronUp className="w-4 h-4 text-slate-500" /></button>
          </div>

          {/* 1. Main Summary Card */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.25rem] p-7 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
              Electricity Bill {translateMonth(config.month)} {billYear}
            </h3>
            
            <div className="space-y-3.5 pt-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Date</span>
                <span className="text-slate-900 dark:text-slate-200 font-black">{formatDateLocalized(config.dateGenerated)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-black uppercase tracking-widest">Total Bill Payable</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">৳{formatNumber(result.totalCollection.toFixed(2))}</span>
              </div>
              
              <div className="text-[10px] text-slate-600 font-black text-center uppercase tracking-widest py-2.5 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                Base Bill: ৳{formatNumber(baseBill.toFixed(2))}
              </div>

              <div className="flex justify-between items-center text-sm pt-2">
                <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Total Units (Main)</span>
                <span className="text-slate-900 dark:text-slate-200 font-black">
                  ({formatNumber(mainMeter.current.toFixed(1))} - {formatNumber(mainMeter.previous.toFixed(1))}) = {formatNumber(mainUnits.toFixed(1))} kWh
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Total User Units</span>
                <span className="text-slate-900 dark:text-slate-200 font-black">{formatNumber(result.totalUnits.toFixed(1))} kWh</span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Rate/Unit (Energy)</span>
                <span className="text-slate-900 dark:text-slate-200 font-black">৳{formatNumber(result.calculatedRate.toFixed(2))}</span>
              </div>
            </div>
          </div>

          {/* 2. Cost Configuration Card */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.25rem] p-7 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
             <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest mb-1">Configuration</h3>
             
             <div className="space-y-3">
               <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-tighter">Demand Charge</span>
                  <span className="text-slate-900 dark:text-slate-200 font-black">৳{formatNumber(tariffConfig.demandCharge.toFixed(2))}</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-tighter">Meter Rent</span>
                  <span className="text-slate-900 dark:text-slate-200 font-black">৳{formatNumber(tariffConfig.meterRent.toFixed(2))}</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-tighter">VAT (Fixed 5%)</span>
                  <span className="text-slate-900 dark:text-slate-200 font-black">৳{formatNumber(result.vatFixed.toFixed(2))}</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-tighter">Total VAT</span>
                  <span className="text-slate-900 dark:text-slate-200 font-black">৳{formatNumber(result.vatTotal.toFixed(2))}</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-tighter">Late Fee</span>
                  <span className="text-slate-900 dark:text-slate-200 font-black">৳{formatNumber(result.lateFee.toFixed(2))}</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-tighter">bKash Fee</span>
                  <span className="text-slate-900 dark:text-slate-200 font-black">৳{formatNumber(bkashFee.toFixed(2))}</span>
               </div>
             </div>

             <div className="h-px bg-slate-100 dark:bg-slate-800 my-4"></div>

             <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest">Shared Fixed Costs</span>
                <span className="text-sm text-slate-900 dark:text-white font-black">৳{formatNumber(totalSharedFixedCosts.toFixed(2))}</span>
             </div>

             <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest">Cost Per User</span>
                <span className="text-sm text-indigo-600 dark:text-indigo-400 font-black">৳{formatNumber(fixedCostPerUser.toFixed(2))}</span>
             </div>

             {systemLoss > 0 && (
               <div className="mt-4 p-3.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex justify-between items-center border border-indigo-100 dark:border-indigo-800/40">
                 <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">System Loss / Common</span>
                 <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">{formatNumber(systemLoss.toFixed(1))} kWh</span>
               </div>
             )}
          </div>

          {/* 3. Individual Bills Card */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.25rem] p-7 shadow-sm border border-slate-100 dark:border-slate-800 space-y-5">
             <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">Individual Bills</h3>
             
             <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-3xl">
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                     <tr className="text-slate-500 font-black uppercase text-[9px] tracking-[0.2em]">
                        <th className="px-5 py-4">User</th>
                        <th className="px-5 py-4 text-right">Units</th>
                        <th className="px-5 py-4 text-right">Bill</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                     {result.userCalculations.map((user) => (
                        <tr key={user.id} className="text-slate-800 dark:text-slate-200">
                           <td className="px-5 py-4 font-black">{user.name || 'User'}</td>
                           <td className="px-5 py-4 text-right text-[10px] font-bold text-slate-500">
                             ({formatNumber(user.current.toFixed(1))} - {formatNumber(user.previous.toFixed(1))}) = {formatNumber(user.unitsUsed.toFixed(1))}
                           </td>
                           <td className="px-5 py-4 text-right font-black text-slate-900 dark:text-white">৳{formatNumber(Math.round(user.totalPayable))}</td>
                        </tr>
                     ))}
                     <tr className="bg-slate-50 dark:bg-slate-800/40">
                        <td colSpan={2} className="px-5 py-5 text-right font-black uppercase tracking-widest text-[10px] text-slate-400">Total Collection</td>
                        <td className="px-5 py-5 text-right font-black text-indigo-900 dark:text-indigo-400 text-xl">৳{formatNumber(Math.round(result.totalCollection))}</td>
                     </tr>
                  </tbody>
               </table>
             </div>

             {/* Action Buttons */}
             <div className="grid grid-cols-2 gap-3.5 mt-6 no-capture">
                <button onClick={handleSavePreview} className="h-14 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/10 active:scale-95 transition-all">
                   <ImageIcon className="w-4 h-4" /> Preview
                </button>
                <button onClick={handleShareImage} className="h-14 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl font-black flex items-center justify-center gap-2 text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                   {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Share
                </button>
             </div>

             <button 
                onClick={onSaveHistory}
                className="no-capture w-full h-12 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 text-xs uppercase tracking-widest shadow-md mt-2 active:scale-95 transition-all"
             >
                <Activity className="w-4 h-4" /> Finalize & Sync
             </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {meterToDelete && (
        <div onClick={() => setMeterToDelete(null)} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-7 shadow-2xl border border-rose-500/20 text-center">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase mb-4 tracking-widest">Confirm Delete</h3>
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">Type <span className="text-rose-500 font-black">DELETE</span> to confirm.</p>
              <input type="text" autoFocus placeholder="DELETE" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="w-full h-12 rounded-xl bg-slate-50 dark:bg-slate-950 border border-rose-500/10 text-center text-sm font-black outline-none uppercase" />
              <button disabled={confirmText.toUpperCase() !== 'DELETE'} onClick={handleConfirmDelete} className="w-full h-12 rounded-xl bg-rose-600 text-white font-black text-xs uppercase tracking-widest disabled:opacity-50">Confirm removal</button>
            </div>
          </div>
        </div>
      )}

      {/* Final Preview & Real Download Modal */}
      {previewImage && (
        <div onClick={() => { setPreviewImage(null); setPreviewBlob(null); }} className="fixed inset-0 z-[110] flex flex-col items-center justify-center p-4 bg-slate-950/95 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="w-full max-w-md flex flex-col gap-4">
             <div className="flex justify-between items-center text-white px-2">
                <span className="text-xs font-black uppercase tracking-widest opacity-60">Report Preview</span>
                <button onClick={() => { setPreviewImage(null); setPreviewBlob(null); }} className="p-2.5 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X className="w-5 h-5" /></button>
             </div>
             
             <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white">
                <img src={previewImage} alt="Bill Preview" className="w-full h-auto" />
             </div>
             
             <div className="flex flex-col gap-3 px-2">
                <button 
                  onClick={downloadImage}
                  className="w-full h-14 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 text-sm uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                >
                   <Download className="w-5 h-5" /> Download to Gallery
                </button>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] text-center mt-2 leading-relaxed opacity-70">
                   If download fails, take a screenshot or long-press the image to save manually.
                </p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
