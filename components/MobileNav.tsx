
import React from 'react';
import { Calculator, History, GitFork } from 'lucide-react';
import { useLanguage } from '../i18n';

interface MobileNavProps {
  currentView: 'home' | 'estimator' | 'history';
  onChangeView: (view: 'home' | 'estimator' | 'history') => void;
}

const MobileNav: React.FC<MobileNavProps> = ({ currentView, onChangeView }) => {
  const { t } = useLanguage();

  const navItems = [
    { id: 'estimator', label: 'Calculator', icon: Calculator },
    { id: 'home', label: 'Splitter', icon: GitFork },
    { id: 'history', label: 'History', icon: History },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 no-print pb-safe bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="max-w-3xl mx-auto h-16 flex items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button 
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className="flex flex-col items-center justify-center flex-1 h-full relative transition-all active:scale-90"
            >
              <div className={`transition-colors duration-200 ${
                isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
              }`}>
                <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
              </div>
              
              <span className={`text-[10px] font-bold mt-1 transition-colors duration-200 ${
                isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
              }`}>
                {item.label}
              </span>

              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"></div>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
