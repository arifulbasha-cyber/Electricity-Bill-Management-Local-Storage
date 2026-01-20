
import React, { useState, useRef } from 'react';
import { SavedBill } from '../types';
import { History, Trash2, Calendar, FileText, X, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../i18n';

interface BillHistoryProps {
  history: SavedBill[];
  onLoad: (bill: SavedBill) => void;
  onDelete: (id: string) => void;
  onViewReport: (bill: SavedBill) => void;
}

const BillHistory: React.FC<BillHistoryProps> = ({ history, onLoad, onDelete, onViewReport }) => {
  const { t, translateMonth, formatNumber } = useLanguage();
  const [billToDelete, setBillToDelete] = useState<SavedBill | null>(null);
  const [confirmText, setConfirmText] = useState('');
  
  const longPressTimerRef = useRef<number | null>(null);

  if (history.length === 0) return (
    <div className="flex flex-col items-center justify-center p-20 bg-indigo-50/50 dark:bg-slate-900/50 rounded-[2.5rem] border border-indigo-100 dark:border-slate-800 text-center transition-colors duration-200">
      <div className="bg-indigo-900 p-6 rounded-[2rem] mb-6 shadow-xl shadow-indigo-900/20">
         <History className="w-12 h-12 text-white" />
      </div>
      <h3 className="text-xl font-black text-indigo-900 dark:text-indigo-400 uppercase tracking-widest">No History</h3>
      <p className="text-slate-500 dark:text-slate-400 mt-4 font-bold">No saved bill records found yet.</p>
    </div>
  );

  const startLongPress = (bill: SavedBill) => {
    longPressTimerRef.current = window.setTimeout(() => {
      setBillToDelete(bill);
      setConfirmText('');
      if ('vibrate' in navigator) navigator.vibrate(50);
    }, 800);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleConfirmDelete = () => {
    if (billToDelete && confirmText.toUpperCase() === 'DELETE') {
      onDelete(billToDelete.id);
      setBillToDelete(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-'); 
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${parseInt(day)}/${parseInt(month)}/${year.slice(-2)}`;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-700 max-w-2xl mx-auto pb-20">
      <div className="space-y-3">
        {history.map((bill) => {
          return (
            <div 
              key={bill.id} 
              className="relative overflow-hidden rounded-[2.5rem] select-none"
              onMouseDown={() => startLongPress(bill)}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={() => startLongPress(bill)}
              onTouchEnd={cancelLongPress}
            >
              <div 
                onClick={() => onViewReport(bill)}
                className="glass-card bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-lg border border-indigo-50 dark:border-white/5 active:scale-[0.98] transition-all duration-300 relative z-10 cursor-pointer hover:border-indigo-500/30"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-900 flex items-center justify-center border border-indigo-900/10 shadow-lg shadow-indigo-900/10">
                        <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900 dark:text-white leading-none mb-2">{translateMonth(bill.config.month)}</h4>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <Calendar className="w-3 h-3 text-indigo-500" />
                        {formatDate(bill.config.dateGenerated)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-black text-indigo-900 dark:text-indigo-400 tracking-tighter leading-none mb-1">
                      ৳{formatNumber(Math.round(bill.config.totalBillPayable))}
                    </div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      {t('saved_at')} {new Date(bill.savedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {billToDelete && (
        <div 
          onClick={() => setBillToDelete(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3rem] p-8 shadow-2xl border border-rose-500/20 animate-in slide-in-from-bottom-4 relative overflow-hidden text-center"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20 shadow-inner">
                     <ShieldAlert className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Hold Triggered</h3>
                </div>
                <button onClick={() => setBillToDelete(null)} className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl active:scale-90 transition-all">
                    <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                    To delete record for <span className="font-black underline">{translateMonth(billToDelete.config.month)}</span>, type <span className="text-rose-500 font-black">DELETE</span>.
                  </p>
                  
                  <div className="relative">
                    <input 
                      type="text"
                      autoFocus
                      placeholder="DELETE"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="w-full h-16 rounded-xl bg-white dark:bg-slate-900 border border-rose-500/20 px-4 text-center text-lg font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-slate-200 dark:placeholder:text-slate-800 uppercase"
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
    </div>
  );
};

export default BillHistory;
