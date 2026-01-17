
import React, { useState } from 'react';
import { TariffConfig } from '../types';
import { DEFAULT_TARIFF_CONFIG } from '../constants';
import { useLanguage } from '../i18n';
import { Save, RotateCcw, Plus, Trash2, Settings } from 'lucide-react';

interface TariffSettingsProps {
  config: TariffConfig;
  onSave: (newConfig: TariffConfig) => void;
}

const TariffSettings: React.FC<TariffSettingsProps> = ({ config, onSave }) => {
  const { t } = useLanguage();
  const [tempConfig, setTempConfig] = useState<TariffConfig>(JSON.parse(JSON.stringify(config)));

  const handleChange = (key: keyof TariffConfig, value: string | number) => {
    setTempConfig({ ...tempConfig, [key]: parseFloat(value.toString()) || 0 });
  };

  const handleSlabChange = (index: number, key: 'limit' | 'rate', value: string) => {
    const newSlabs = [...tempConfig.slabs];
    newSlabs[index] = { ...newSlabs[index], [key]: parseFloat(value) || 0 };
    setTempConfig({ ...tempConfig, slabs: newSlabs });
  };

  const addSlab = () => {
    const lastSlab = tempConfig.slabs[tempConfig.slabs.length - 1];
    setTempConfig({
      ...tempConfig,
      slabs: [...tempConfig.slabs, { limit: lastSlab ? lastSlab.limit + 100 : 100, rate: lastSlab ? lastSlab.rate : 0 }]
    });
  };

  const removeSlab = (index: number) => {
    const newSlabs = tempConfig.slabs.filter((_, i) => i !== index);
    setTempConfig({ ...tempConfig, slabs: newSlabs });
  };

  const handleSave = () => {
    onSave(tempConfig);
    alert(t('saved_success'));
  };

  const handleReset = () => {
    if (window.confirm('Reset all rates to default?')) {
      setTempConfig(DEFAULT_TARIFF_CONFIG);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 w-full rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col transition-colors duration-200 overflow-hidden">
      <div className="p-8 border-b border-indigo-700/10 dark:border-indigo-500/10 bg-indigo-900 dark:bg-indigo-950/40">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-2xl shadow-lg">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">{t('tariff_settings')}</h2>
            <p className="text-sm font-bold text-indigo-100 mt-1 uppercase tracking-widest">{t('tariff_desc')}</p>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{t('demand_charge')}</label>
            <input
              type="number"
              value={tempConfig.demandCharge}
              onChange={(e) => handleChange('demandCharge', e.target.value)}
              className="w-full rounded-xl h-14 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold px-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{t('meter_rent')}</label>
            <input
              type="number"
              value={tempConfig.meterRent}
              onChange={(e) => handleChange('meterRent', e.target.value)}
              className="w-full rounded-xl h-14 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold px-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{t('vat_rate_percent')}</label>
            <div className="relative">
              <input
                type="number"
                value={tempConfig.vatRate * 100}
                onChange={(e) => setTempConfig({...tempConfig, vatRate: (parseFloat(e.target.value) || 0) / 100})}
                className="w-full rounded-xl h-14 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold px-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all pr-12"
              />
              <span className="absolute right-4 top-4 font-black text-slate-400">%</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{t('bkash_charge')}</label>
            <input
              type="number"
              value={tempConfig.bkashCharge}
              onChange={(e) => handleChange('bkashCharge', e.target.value)}
              className="w-full rounded-xl h-14 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold px-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{t('slab_rates_config')}</label>
            <button 
              onClick={addSlab}
              className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-4 py-2 rounded-xl transition-all flex items-center gap-2 border border-indigo-100 dark:border-indigo-800"
            >
              <Plus className="w-4 h-4" /> {t('add_slab')}
            </button>
          </div>
          
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">{t('limit')}</th>
                  <th className="px-6 py-4">{t('rate_per_unit')}</th>
                  <th className="px-4 py-4 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {tempConfig.slabs.map((slab, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-3">
                      <input
                        type="number"
                        value={slab.limit}
                        onChange={(e) => handleSlabChange(idx, 'limit', e.target.value)}
                        className="w-full bg-transparent text-slate-900 dark:text-white font-bold py-1 outline-none"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="number"
                        value={slab.rate}
                        onChange={(e) => handleSlabChange(idx, 'rate', e.target.value)}
                        className="w-full bg-transparent text-slate-900 dark:text-white font-bold py-1 outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => removeSlab(idx)}
                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tempConfig.slabs.length === 0 && (
               <div className="p-8 text-center text-slate-400 font-bold text-sm bg-slate-50/50 dark:bg-slate-800/20 uppercase tracking-widest">No slabs defined. Add one to start.</div>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center bg-slate-50/50 dark:bg-slate-800/30 gap-4">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 text-sm font-black text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest"
        >
          <RotateCcw className="w-4 h-4" /> {t('reset_defaults')}
        </button>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={handleSave}
            className="flex-1 sm:flex-none px-8 py-4 text-sm font-black text-white bg-indigo-900 hover:bg-indigo-800 rounded-2xl shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Save className="w-4 h-4" /> {t('save_changes')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TariffSettings;
