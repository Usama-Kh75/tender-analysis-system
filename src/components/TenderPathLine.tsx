import React from 'react';
import type { TenderPath } from '../utils/tenderPath';

export type PathTarget = 'estimate' | 'bids' | 'audit' | 'award' | 'status';

interface TenderPathLineProps {
  path: TenderPath;
  onGo: (t: PathTarget) => void;
}

type Tone = 'green' | 'amber' | 'neutral';
const TONE: Record<Tone, string> = {
  green: 'text-emerald-800 hover:bg-emerald-50',
  amber: 'text-amber-800 hover:bg-amber-50',
  neutral: 'text-slate-600 hover:bg-slate-100'
};

// سطر تحت العنوان في التبويبات الثلاثة: «الموقف» (حالة تلازم الطلبية، منفصلة بلا سهم)
// ثم «مسار المناقصة» خطوات بينها أسهم. كل عنصر زر ينقل إلى مكانه.
export const TenderPathLine: React.FC<TenderPathLineProps> = ({ path, onGo }) => {
  const steps: { key: PathTarget; text: string; tone: Tone }[] = [];

  steps.push({
    key: 'estimate',
    text: path.hasEstimate ? '✓ الكلفة التخمينية' : 'بانتظار الكلفة التخمينية',
    tone: path.hasEstimate ? 'green' : 'amber'
  });
  steps.push({
    key: 'bids',
    text: `العطاءات ${path.bids.entered} من ${path.bids.expected}`,
    tone: path.bids.entered > 0 && path.bids.entered === path.bids.expected ? 'green' : 'neutral'
  });
  // لا يظهر قبل أي مبالغ: لا شيء يُدقَّق بعد
  if (path.bids.entered > 0) {
    steps.push(path.audit.pending > 0
      ? { key: 'audit', text: `التدقيق: ${path.audit.pending} فقرة بانتظار قرار`, tone: 'amber' }
      : { key: 'audit', text: '✓ التدقيق', tone: 'green' });
  }
  steps.push(path.award
    ? { key: 'award', text: `التوصية: ${path.award.name}`, tone: 'green' }
    : { key: 'award', text: 'التوصية: لم تُختر', tone: 'neutral' });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-slate-100 text-xs">
      <span className="font-bold text-slate-500">الموقف:</span>
      <button
        onClick={() => onGo('status')}
        title="الانتقال إلى تبويب الموقف"
        className={`font-black px-2.5 py-1 rounded-full border cursor-pointer transition ${
          path.status === null
            ? 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
            : 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
        }`}
      >
        {path.status === null ? 'حدد الموقف' : path.status || 'غير محدد'}
      </button>

      {/* الفاصل مع العنوان في عنصر واحد كي يلتفا معاً */}
      <span className="inline-flex items-center gap-3">
        <span className="w-px h-4 bg-slate-300" aria-hidden="true" />
        <span className="font-bold text-slate-500">مسار المناقصة:</span>
      </span>
      {steps.map((s, i) => (
        <button
          key={s.key}
          onClick={() => onGo(s.key)}
          className={`inline-flex items-start gap-2 font-bold px-1.5 py-0.5 rounded-md cursor-pointer transition text-right ${TONE[s.tone]}`}
        >
          {/* السهم داخل العنصر كي لا ينفصل عنه عند الالتفاف */}
          {i > 0 && <span className="text-slate-400 shrink-0" aria-hidden="true">←</span>}
          <span>{s.text}</span>
        </button>
      ))}
    </div>
  );
};
