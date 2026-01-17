
import React, { useRef, useState } from 'react';
import { BillCalculationResult, BillConfig, MeterReading, TariffConfig } from '../types';
import { FileText, Printer, Image as ImageIcon, Save, Loader2, X, FileDown } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useLanguage } from '../i18n';

interface CalculationSummaryProps {
  result: BillCalculationResult;
  config: BillConfig;
  mainMeter: MeterReading;
  meters: MeterReading[];
  onSaveHistory: () => void;
  tariffConfig: TariffConfig;
  isHistorical?: boolean;
  onClose?: () => void;
}

const CalculationSummary: React.FC<CalculationSummaryProps> = ({ result, config, mainMeter, meters, onSaveHistory, tariffConfig, isHistorical = false, onClose }) => {
  const { t, formatNumber, translateMonth, formatDateLocalized } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const DEMAND_CHARGE = tariffConfig.demandCharge;
  const METER_RENT = tariffConfig.meterRent;
  const bKashFee = config.includeBkashFee ? tariffConfig.bkashCharge : 0;
  const baseBill = result.totalCollection - result.lateFee - bKashFee;
  const totalSharedFixedCosts = DEMAND_CHARGE + METER_RENT + result.vatFixed + result.lateFee + bKashFee;
  const fixedCostPerUser = meters.length > 0 ? totalSharedFixedCosts / meters.length : 0;

  const handlePrint = () => {
    window.print();
  };

  const getCaptureCanvas = async (scale: number = 3) => {
      if (!reportRef.current) return null;
      
      const element = reportRef.current;
      const clone = element.cloneNode(true) as HTMLElement;
      
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '450px'; // Set a fixed width for mobile-like appearance in capture
      container.style.backgroundColor = '#f8fafc'; 
      
      clone.classList.remove('dark');
      const allDark = clone.querySelectorAll('.dark');
      allDark.forEach(el => el.classList.remove('dark'));
      
      container.appendChild(clone);
      document.body.appendChild(container);

      await new Promise(resolve => setTimeout(resolve, 150));
      
      const canvas = await html2canvas(clone, {
        scale: scale, 
        backgroundColor: '#f8fafc',
        logging: false,
        useCORS: true,
        width: 450,
        windowWidth: 450 
      });
      
      document.body.removeChild(container);
      return canvas;
  };

  const handleSaveImage = async () => {
    try {
      setIsGeneratingImage(true);
      const canvas = await getCaptureCanvas(3);
      if (!canvas) return;
      
      const image = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.href = image;
      link.download = `Bill-Report-${config.month}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to generate image", error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSavePDF = async () => {
    try {
      setIsGeneratingPdf(true);
      const canvas = await getCaptureCanvas(2); 
      if (!canvas) return;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      pdf.save(`Bill-Report-${config.month}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const mainUnits = Math.max(0, mainMeter.current - mainMeter.previous);

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen pb-20">
       {/* Actions Bar (No Print) */}
       <div className="sticky top-0 z-50 bg-indigo-900 px-4 py-4 flex justify-between items-center no-print shadow-lg">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 text-white/90 hover:bg-white/10 rounded-full">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">
               Bill for {translateMonth(config.month)} {config.dateGenerated.split('-')[0]}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSaveImage} className="p-2 text-white/90 hover:bg-white/10 rounded-lg">
               {isGeneratingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
            </button>
            <button onClick={handleSavePDF} className="p-2 text-white/90 hover:bg-white/10 rounded-lg">
               {isGeneratingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
            </button>
          </div>
       </div>

       {/* Printable Content */}
       <div ref={reportRef} className="p-4 sm:p-6 space-y-4 print:p-0 print:bg-white max-w-lg mx-auto">
          
          {/* 1. Summary Section */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
             <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Summary</h3>
             
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
                   (Base Bill: ৳{formatNumber(baseBill.toFixed(2))} + Late Fee: ৳{formatNumber(result.lateFee.toFixed(2))} + bKash Fee: ৳{formatNumber(bKashFee.toFixed(2))})
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
                <span className="text-slate-800 dark:text-slate-200 font-bold">৳{formatNumber(DEMAND_CHARGE.toFixed(2))}</span>
             </div>

             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Meter Rent</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">৳{formatNumber(METER_RENT.toFixed(2))}</span>
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
                <span className="text-slate-800 dark:text-slate-200 font-bold">৳{formatNumber(bKashFee.toFixed(2))}</span>
             </div>

             <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"></div>

             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400 font-bold">Total Shared Fixed Costs</span>
                <span className="text-slate-900 dark:text-white font-black">৳{formatNumber(totalSharedFixedCosts.toFixed(2))}</span>
             </div>

             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400 font-bold">Fixed Cost Per User</span>
                <span className="text-slate-900 dark:text-white font-black">৳{formatNumber(fixedCostPerUser.toFixed(2))}</span>
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
          </div>
       </div>
    </div>
  );
};

export default CalculationSummary;
