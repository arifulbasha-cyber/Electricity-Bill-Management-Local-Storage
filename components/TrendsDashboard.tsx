
import React, { useMemo } from 'react';
import { SavedBill, TariffConfig, Slab } from '../types';
import { useLanguage } from '../i18n';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Zap, CreditCard, Table as TableIcon } from 'lucide-react';
import { useTheme } from './ThemeContext';

interface TrendsDashboardProps {
  history: SavedBill[];
  tariffConfig: TariffConfig;
}

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

const TrendsDashboard: React.FC<TrendsDashboardProps> = ({ history, tariffConfig }) => {
  const { t, formatNumber, translateMonth } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const sortedData = useMemo(() => {
    return [...history].sort((a, b) => new Date(a.config.dateGenerated).getTime() - new Date(b.config.dateGenerated).getTime());
  }, [history]);

  const chartData = useMemo(() => {
    return sortedData.map(bill => {
      const dataPoint: any = {
        name: bill.config.month.substring(0, 3),
        fullMonth: bill.config.month,
        amount: bill.config.totalBillPayable,
        date: bill.config.dateGenerated,
        monthTotal: 0,
      };

      const mainUnits = Math.max(0, bill.mainMeter.current - bill.mainMeter.previous);
      const energyCostBase = calculateEnergyCost(mainUnits, tariffConfig.slabs);
      const fixedBase = tariffConfig.demandCharge + tariffConfig.meterRent;
      const taxableBase = energyCostBase + fixedBase;
      const vatTotal = taxableBase * tariffConfig.vatRate;
      const lateFee = bill.config.includeLateFee ? vatTotal : 0;
      const bkash = bill.config.includeBkashFee ? tariffConfig.bkashCharge : 0;
      
      const vatFixed = fixedBase * tariffConfig.vatRate;
      const vatDistributed = vatTotal - vatFixed;
      
      let totalSubmeterUnits = 0;
      bill.meters.forEach(m => {
        const units = m.current - m.previous;
        totalSubmeterUnits += units > 0 ? units : 0;
      });

      const fixedSharedPool = fixedBase + vatFixed + bkash + lateFee;
      const fixedCostPerUser = bill.meters.length > 0 ? fixedSharedPool / bill.meters.length : 0;
      const energySharedPool = energyCostBase + vatDistributed;
      const calculatedRate = totalSubmeterUnits > 0 ? energySharedPool / totalSubmeterUnits : 0;

      let monthSum = 0;
      bill.meters.forEach(m => {
        const units = Math.max(0, m.current - m.previous);
        const userEnergyCost = units * calculatedRate;
        const totalPayable = userEnergyCost + fixedCostPerUser;
        const roundedTotal = Math.round(totalPayable);
        
        dataPoint[m.name] = units;
        dataPoint[`${m.name}_cost`] = roundedTotal;
        monthSum += roundedTotal;
      });
      dataPoint.monthTotal = monthSum;

      return dataPoint;
    });
  }, [sortedData, tariffConfig]);

  const uniqueUsers = useMemo(() => {
    const users = new Set<string>();
    history.forEach(bill => {
      bill.meters.forEach(m => users.add(m.name));
    });
    return Array.from(users);
  }, [history]);

  const stats = useMemo(() => {
    if (history.length === 0) return { avg: 0, max: 0, total: 0, trend: 0 };
    
    const amounts = history.map(h => h.config.totalBillPayable);
    const total = amounts.reduce((a, b) => a + b, 0);
    const avg = total / amounts.length;
    const max = Math.max(...amounts);

    let trend = 0;
    if (history.length >= 2) {
      const current = sortedData[sortedData.length - 1].config.totalBillPayable;
      const prev = sortedData[sortedData.length - 2].config.totalBillPayable;
      trend = ((current - prev) / prev) * 100;
    }

    return { avg, max, total, trend };
  }, [history, sortedData]);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 text-center transition-colors duration-200">
        <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-[2rem] mb-6">
           <TrendingUp className="w-12 h-12 text-slate-300 dark:text-slate-600" />
        </div>
        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">{t('trends_dashboard')}</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-4 font-bold">{t('no_history_data')}</p>
      </div>
    );
  }

  const colors = ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#312e81', '#3730a3'];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4 mb-8">
            <div className="bg-indigo-900 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
                <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{t('trends_dashboard')}</h2>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Historical Intelligence Dashboard</p>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800/60">
                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5" /> {t('avg_bill')}
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">৳{formatNumber(Math.round(stats.avg))}</div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800/60">
                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5" /> {t('max_bill')}
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">৳{formatNumber(stats.max)}</div>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/30">
                <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" /> {t('total_paid')}
                </div>
                <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-2 font-mono">৳{formatNumber(stats.total)}</div>
                {stats.trend !== 0 && (
                    <div className={`text-[10px] font-black mt-1 flex items-center gap-1 uppercase tracking-widest ${stats.trend > 0 ? 'text-rose-500' : 'text-indigo-500'}`}>
                        {stats.trend > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {formatNumber(Math.abs(stats.trend).toFixed(1))}% {stats.trend > 0 ? t('insight_increase') : t('insight_decrease')}
                    </div>
                )}
            </div>
        </div>

        <div className="space-y-12">
            {/* 1. Total Bill Trend */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-200">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
                   <CreditCard className="w-4 h-4" /> {t('bill_history_trend')} (৳)
                </h3>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid stroke={isDark ? "#1e293b" : "#f1f5f9"} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" stroke={isDark ? "#475569" : "#94a3b8"} fontSize={10} fontWeight={800} tickLine={false} axisLine={false} />
                        <YAxis stroke={isDark ? "#475569" : "#94a3b8"} fontSize={10} fontWeight={800} tickLine={false} axisLine={false} tickFormatter={(val) => `৳${val}`} />
                        <Tooltip 
                        contentStyle={{ 
                            backgroundColor: isDark ? '#0f172a' : '#fff', 
                            borderRadius: '16px', 
                            border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                            color: isDark ? '#f8fafc' : '#1e293b',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }}
                        itemStyle={{ color: isDark ? '#818cf8' : '#4f46e5', fontWeight: 900 }}
                        />
                        <Line type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={4} dot={{ r: 6, fill: '#4f46e5', strokeWidth: 3, stroke: isDark ? '#0f172a' : '#fff' }} activeDot={{ r: 8 }} />
                    </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 2. User Consumption (Units) */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-200">
                    <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
                       <Zap className="w-4 h-4" /> {t('consumption_trend')} (kWh)
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid stroke={isDark ? "#1e293b" : "#f1f5f9"} strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" stroke={isDark ? "#475569" : "#94a3b8"} fontSize={10} fontWeight={800} tickLine={false} axisLine={false} />
                            <YAxis stroke={isDark ? "#475569" : "#94a3b8"} fontSize={10} fontWeight={800} tickLine={false} axisLine={false} />
                            <Tooltip 
                            cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }}
                            contentStyle={{ 
                                backgroundColor: isDark ? '#0f172a' : '#fff', 
                                borderRadius: '16px', 
                                border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                                color: isDark ? '#f8fafc' : '#1e293b',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                            }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: '20px', color: isDark ? '#cbd5e1' : '#64748b' }} />
                            {uniqueUsers.map((user, idx) => (
                            <Bar key={user} dataKey={user} stackId="a" fill={colors[idx % colors.length]} radius={[2, 2, 0, 0]} />
                            ))}
                        </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. User Bill Trend (BDT) */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-200">
                    <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
                       <DollarSign className="w-4 h-4" /> User Bill Distribution (৳)
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid stroke={isDark ? "#1e293b" : "#f1f5f9"} strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" stroke={isDark ? "#475569" : "#94a3b8"} fontSize={10} fontWeight={800} tickLine={false} axisLine={false} />
                            <YAxis stroke={isDark ? "#475569" : "#94a3b8"} fontSize={10} fontWeight={800} tickLine={false} axisLine={false} tickFormatter={(val) => `৳${val}`} />
                            <Tooltip 
                            cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }}
                            contentStyle={{ 
                                backgroundColor: isDark ? '#0f172a' : '#fff', 
                                borderRadius: '16px', 
                                border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                                color: isDark ? '#f8fafc' : '#1e293b',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                            }}
                            formatter={(value) => [`৳${value}`, 'Amount']}
                            />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: '20px', color: isDark ? '#cbd5e1' : '#64748b' }} />
                            {uniqueUsers.map((user, idx) => (
                            <Bar key={`${user}_cost`} name={user} dataKey={`${user}_cost`} stackId="b" fill={colors[idx % colors.length]} radius={[2, 2, 0, 0]} />
                            ))}
                        </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 4. Numeric Summary Table */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <TableIcon className="w-4 h-4" /> Monthly Billing Summary (৳)
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px] border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                <th className="py-4 px-2 font-black text-slate-400 uppercase tracking-widest">Month</th>
                                {uniqueUsers.map(user => (
                                    <th key={user} className="py-4 px-2 font-black text-slate-900 dark:text-white uppercase tracking-tight text-center">{user}</th>
                                ))}
                                <th className="py-4 px-2 font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {chartData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="py-4 px-2 font-black text-slate-900 dark:text-white">{translateMonth(row.fullMonth)}</td>
                                    {uniqueUsers.map(user => (
                                        <td key={user} className="py-4 px-2 text-center font-bold text-slate-600 dark:text-slate-400">
                                            {row[`${user}_cost`] ? `৳${formatNumber(row[`${user}_cost`])}` : '-'}
                                        </td>
                                    ))}
                                    <td className="py-4 px-2 text-right font-black text-indigo-600 dark:text-indigo-400">
                                        ৳{formatNumber(row.monthTotal)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-indigo-50/30 dark:bg-indigo-900/10 font-black">
                                <td className="py-4 px-2 text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Grand Total</td>
                                {uniqueUsers.map(user => {
                                    const userTotal = chartData.reduce((acc, row) => acc + (row[`${user}_cost`] || 0), 0);
                                    return (
                                        <td key={user} className="py-4 px-2 text-center text-slate-900 dark:text-white">
                                            ৳{formatNumber(userTotal)}
                                        </td>
                                    );
                                })}
                                <td className="py-4 px-2 text-right text-indigo-600 dark:text-indigo-400 text-base">
                                    ৳{formatNumber(chartData.reduce((acc, row) => acc + row.monthTotal, 0))}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TrendsDashboard;
