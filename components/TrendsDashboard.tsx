
import React, { useMemo } from 'react';
import { SavedBill } from '../types';
import { useLanguage } from '../i18n';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import { useTheme } from './ThemeContext';

interface TrendsDashboardProps {
  history: SavedBill[];
}

const TrendsDashboard: React.FC<TrendsDashboardProps> = ({ history }) => {
  const { t, formatNumber } = useLanguage();
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
      };

      bill.meters.forEach(m => {
        const units = Math.max(0, m.current - m.previous);
        dataPoint[m.name] = units;
      });

      return dataPoint;
    });
  }, [sortedData]);

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-200">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-8">{t('bill_history_trend')}</h3>
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

            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-200">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-8">{t('consumption_trend')}</h3>
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
        </div>
      </div>
    </div>
  );
};

export default TrendsDashboard;
