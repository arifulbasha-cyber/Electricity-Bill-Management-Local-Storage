
import React from 'react';
import { UserCalculation } from '../types';
import { PieChart } from 'lucide-react';
import { useLanguage } from '../i18n';

interface ConsumptionStatsProps {
  calculations: UserCalculation[];
  totalUnits: number;
}

const ConsumptionStats: React.FC<ConsumptionStatsProps> = ({ calculations, totalUnits }) => {
  const { t, formatNumber } = useLanguage();
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-200 overflow-hidden">
      <div className="flex items-center gap-4 p-8 border-b border-indigo-700/10 dark:border-indigo-500/10 bg-indigo-900 dark:bg-indigo-950/40">
        <div className="bg-white/20 p-3 rounded-2xl shadow-lg">
          <PieChart className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">{t('consumption_share')}</h2>
          <p className="text-sm font-bold text-indigo-100 uppercase tracking-widest">Global Resource Allocation</p>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {calculations.map((user, index) => {
          const percentage = totalUnits > 0 ? (user.unitsUsed / totalUnits) * 100 : 0;
          const colors = ['bg-indigo-600', 'bg-blue-600', 'bg-violet-600', 'bg-indigo-400', 'bg-blue-400', 'bg-slate-600'];
          const colorClass = colors[index % colors.length];

          return (
            <div key={user.id} className="group">
              <div className="flex justify-between items-end text-sm mb-3">
                <div className="flex items-center gap-3">
                   <div className={`w-3 h-3 rounded-full ${colorClass} shadow-lg shadow-indigo-500/20`}></div>
                   <span className="font-black text-slate-800 dark:text-slate-200 text-base">{user.name || 'User'}</span>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="font-black text-slate-900 dark:text-slate-100 text-lg leading-none">{formatNumber(percentage.toFixed(1))}%</span>
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{formatNumber(user.unitsUsed)} kWh Total</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                <div 
                  className={`${colorClass} h-full rounded-full transition-all duration-1000 ease-out`} 
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
        
        {calculations.length === 0 && (
          <div className="text-center py-20 bg-slate-50/50 dark:bg-slate-800/20 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <PieChart className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <div className="text-slate-400 font-black uppercase tracking-widest text-sm">{t('no_active_meters')}</div>
          </div>
        )}
      </div>

      {totalUnits > 0 && (
        <div className="mx-8 mb-8 p-6 bg-slate-50 dark:bg-slate-800/30 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accumulated System Consumption</div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">{formatNumber(totalUnits)} <span className="text-sm uppercase">kWh</span></div>
        </div>
      )}
    </div>
  );
};

export default ConsumptionStats;
