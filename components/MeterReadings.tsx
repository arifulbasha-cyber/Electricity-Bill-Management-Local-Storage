
import React, { useState, useRef } from 'react';
import { MeterReading, Tenant, TariffConfig } from '../types';
import { Users, Trash2, Plus, Zap, Lock, ChevronDown, ChevronUp, Activity, ShieldAlert, X } from 'lucide-react';
import { useLanguage } from '../i18n';

interface MeterReadingsProps {
  mainMeter: MeterReading;
  onMainMeterUpdate: (reading: MeterReading) => void;
  readings: MeterReading[];
  onUpdate: (readings: MeterReading[]) => void;
  tenants: Tenant[];
  onManageTenants?: () => void;
  maxUnits?: number; 
  calculatedRate?: number;
  tariffConfig?: TariffConfig;
  readOnly?: boolean;
}

const MeterReadings: React.FC<MeterReadingsProps> = ({ 
  mainMeter, onMainMeterUpdate, readings, onUpdate, tenants, onManageTenants, 
  maxUnits = 1, calculatedRate = 0, tariffConfig, readOnly = false
}) => {
  const { t, formatNumber } = useLanguage();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [meterToDelete, setMeterToDelete] = useState<MeterReading | null>(null);
  const [confirmText, setConfirmText] = useState('');
  
  const longPressTimerRef = useRef<number | null>(null);

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedCards);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedCards(newSet);
  };
  
  const handleChange = (id: string, key: keyof MeterReading, value: string | number) => {
    if (readOnly) return;
    onUpdate(readings.map(r => r.id === id ? { ...r, [key]: value } : r));
  };

  const handleMainMeterChange = (key: keyof MeterReading, value: string | number) => {
    if (readOnly) return;
    onMainMeterUpdate({ ...mainMeter, [key]: value });
  };

  const startLongPress = (reading: MeterReading) => {
    if (readOnly) return;
    longPressTimerRef.current = window.setTimeout(() => {
      setMeterToDelete(reading);
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
      onUpdate(readings.filter(r => r.id !== meterToDelete.id));
      setMeterToDelete(null);
    }
  };

  const totalUserUnits = readings.reduce((acc, r) => acc + Math.max(0, r.current - r.previous), 0);
  const mainMeterUnits = Math.max(0, mainMeter.current - mainMeter.previous);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">{t('meter_readings')}</h2>
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{readings.length} ACTIVE SLOTS</span>
        </div>
        {!readOnly && (
            <button 
                onClick={() => {
                  const newId = Date.now().toString();
                  onUpdate([...readings, { id: newId, name: 'New User', meterNo: (readings.length + 1).toString(), previous: 0, current: 0 }]);
                  setExpandedCards(prev => new Set(prev).add(newId));
                }}
                className="bg-emerald-600 text-white p-2 rounded-xl shadow-lg active:scale-90 transition-all border border-emerald-500/20"
            >
                <Plus className="w-5 h-5" />
            </button>
        )}
      </div>

      {/* Main Meter Section - Compact */}
      <div className="glass-card rounded-2xl p-4 shadow-md relative overflow-hidden group">
           <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center text-emerald-600">
                    <Lock className="w-5 h-5" />
                 </div>
                 <div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">{t('main_meter')}</h3>
                    <div className="text-[8px] text-slate-400 font-bold uppercase">METER ID: {formatNumber(mainMeter.meterNo)}</div>
                 </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">{formatNumber(mainMeterUnits)} <span className="text-[10px] tracking-normal font-bold">kWh</span></span>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-2">
              <div className="relative h-10 flex items-center border border-slate-100 dark:border-slate-800 rounded-xl px-3 bg-black/5 dark:bg-white/5">
                 <span className="absolute -top-1.5 left-2 text-[7px] font-black uppercase tracking-widest text-slate-500 bg-white dark:bg-slate-900 px-1">{t('previous')}</span>
                 <input
                    readOnly={readOnly} type="number" value={mainMeter.previous}
                    onChange={(e) => handleMainMeterChange('previous', parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-transparent text-sm font-black text-slate-600 dark:text-slate-400 outline-none"
                 />
              </div>
              <div className="relative h-10 flex items-center border border-slate-100 dark:border-slate-800 rounded-xl px-3 bg-black/5 dark:bg-white/5">
                 <span className="absolute -top-1.5 left-2 text-[7px] font-black uppercase tracking-widest text-emerald-500 bg-white dark:bg-slate-900 px-1">{t('current')}</span>
                 <input
                    readOnly={readOnly} type="number" value={mainMeter.current}
                    onChange={(e) => handleMainMeterChange('current', parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-transparent text-sm font-black text-slate-900 dark:text-white outline-none"
                 />
              </div>
           </div>
      </div>

      {/* Individual Meter List - Compact */}
      <div className="space-y-2">
        {readings.map((reading) => {
             const units = Math.max(0, reading.current - reading.previous);
             const isExpanded = expandedCards.has(reading.id);
             const estimatedCost = units * calculatedRate;
             
             return (
               <div 
                 key={reading.id} 
                 onMouseDown={() => startLongPress(reading)}
                 onMouseUp={endLongPress}
                 onMouseLeave={endLongPress}
                 onTouchStart={() => startLongPress(reading)}
                 onTouchEnd={endLongPress}
                 className="relative overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800"
               >
                 <div className="glass-card bg-white dark:bg-slate-900 p-3 shadow-sm active:scale-[0.99] select-none">
                    <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleExpand(reading.id)}>
                       <div className="flex items-center gap-3 min-w-0">
                           <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center border border-slate-100 dark:border-slate-800 text-indigo-600 font-black text-[10px]">
                              {reading.name.substring(0, 2).toUpperCase() || 'U'}
                           </div>
                           <div className="min-w-0">
                              <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">{t(reading.name)}</h3>
                              <div className="text-[8px] text-slate-400 font-black uppercase">MTR: {formatNumber(reading.meterNo)}</div>
                           </div>
                       </div>
                       <div className="text-right flex items-center gap-4">
                           <div className="flex flex-col items-end">
                              <div className="text-sm font-black text-slate-900 dark:text-white leading-none">৳{formatNumber(Math.round(estimatedCost))}</div>
                              <div className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase">{formatNumber(units)} UNIT</div>
                           </div>
                           {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                       </div>
                    </div>

                    {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-800 space-y-3 animate-in slide-in-from-top-2 duration-300">
                           <div className="grid grid-cols-2 gap-2">
                              <div className="relative h-9 flex items-center border border-slate-100 dark:border-slate-800 rounded-lg px-2">
                                 <span className="absolute -top-1.5 left-2 text-[7px] font-black uppercase tracking-widest text-slate-500 bg-white dark:bg-slate-900 px-1">{t('previous')}</span>
                                 <input
                                    readOnly={readOnly} type="number" value={reading.previous}
                                    onChange={(e) => handleChange(reading.id, 'previous', parseFloat(e.target.value) || 0)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full bg-transparent text-xs font-bold text-slate-500 outline-none text-right"
                                 />
                              </div>
                              <div className="relative h-9 flex items-center border border-slate-100 dark:border-slate-800 rounded-lg px-2">
                                 <span className="absolute -top-1.5 left-2 text-[7px] font-black uppercase tracking-widest text-emerald-500 bg-white dark:bg-slate-900 px-1">{t('current')}</span>
                                 <input
                                     readOnly={readOnly} type="number" value={reading.current}
                                     onChange={(e) => handleChange(reading.id, 'current', parseFloat(e.target.value) || 0)}
                                     onFocus={(e) => e.target.select()}
                                     className="w-full bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none text-right"
                                 />
                              </div>
                           </div>
                           <div className="flex items-center gap-2">
                              <select
                                 disabled={readOnly} value={tenants.some(t => t.name === reading.name) ? reading.name : ''}
                                 onChange={(e) => handleChange(reading.id, 'name', e.target.value)}
                                 className="flex-1 h-9 rounded-lg border border-slate-100 dark:border-slate-800 bg-black/5 dark:bg-white/5 text-[10px] font-bold px-3 outline-none"
                              >
                                 <option value="" disabled>{t('select_tenant')}</option>
                                 {tenants.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                              </select>
                           </div>
                        </div>
                    )}
                 </div>
               </div>
             );
        })}
      </div>

      {/* Delete Modal - Scaled Down */}
      {meterToDelete && (
        <div 
          onClick={() => setMeterToDelete(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-rose-500/10 text-center"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase">Hold Triggered</h3>
              <button onClick={() => setMeterToDelete(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">Type <span className="text-rose-500 font-black">DELETE</span> to confirm.</p>
              <input 
                type="text"
                autoFocus
                placeholder="DELETE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full h-12 rounded-xl bg-slate-50 dark:bg-slate-950 text-center text-sm font-black outline-none border border-rose-500/10"
              />
              <button 
                disabled={confirmText.toUpperCase() !== 'DELETE'}
                onClick={handleConfirmDelete}
                className="w-full h-12 rounded-xl bg-rose-600 text-white font-black text-xs uppercase tracking-widest"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aggregated Total Units - Thinner */}
      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 border-dashed flex justify-between items-center px-1">
          <div className="flex items-center gap-3">
              <div className="bg-slate-900 dark:bg-white p-2 rounded-lg">
                  <Activity className="w-4 h-4 text-white dark:text-slate-900" />
              </div>
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">{t('total_user_units')}</span>
              </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                {formatNumber(totalUserUnits)} <span className="text-[10px] tracking-normal font-bold text-slate-400 uppercase">kWh</span>
            </div>
          </div>
      </div>
    </div>
  );
};

export default MeterReadings;
