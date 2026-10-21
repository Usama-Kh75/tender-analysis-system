import React from 'react';
import { versionLabel } from '../changelog';

// التذييل الدائم: اسم النظام وزر الإصدار والتوقيع
export const AppFooter: React.FC<{ onOpenWhatsNew: () => void }> = ({ onOpenWhatsNew }) => (
  <footer className="bg-slate-950 text-slate-400 text-xs py-4 border-t border-slate-800 mt-auto">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-amber-400 font-bold">نظام تحليل العطاءات التجاري المتكامل</span>
        <button
          onClick={() => onOpenWhatsNew()}
          title="ما الجديد في هذا الإصدار"
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono px-1.5 py-0.5 rounded-md border border-slate-700 cursor-pointer transition"
        >
          {versionLabel()}
        </button>
      </div>

      <div className="text-emerald-400 font-bold">
        إعداد المهندس أسامة خليل هاشم
      </div>
    </div>
  </footer>
);
