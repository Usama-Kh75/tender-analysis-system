import React from 'react';
import { LEGAL_TEXTS, type LegalKey } from '../utils/legalTexts';

/**
 * قائمة النصوص الرسمية للفقرات المذكورة في توصية المحضر: رقم الفقرة بخط عريض ثم نصها الحرفي بين «».
 * مكوّن مستقل ليُعاد استعماله في محضر يضم أكثر من طلبية.
 */
export const LegalTextsList: React.FC<{ keys: LegalKey[] }> = ({ keys }) => {
  if (keys.length === 0) return null;
  return (
    <div className="mt-3 pt-2 border-t border-slate-300">
      <div className="font-bold text-slate-900 mb-1">النصوص المستند إليها من تعليمات تنفيذ العقود الحكومية رقم (1) لسنة 2025 والضوابط الصادرة بموجبها:</div>
      <ul className="space-y-1">
        {keys.map(k => (
          <li key={k}><strong>{LEGAL_TEXTS[k].label}:</strong> «{LEGAL_TEXTS[k].text}»</li>
        ))}
      </ul>
    </div>
  );
};

/** سند الحد المعتمد حين يختلف أحد الحدّين عن نص التعليمات (20%)؛ الفارغ خط منقّط يُكتب بخط اليد */
export const ThresholdBasisSentence: React.FC<{ exclusion: number; item: number; basis?: string }> = ({ exclusion, item, basis }) => {
  if (exclusion === 20 && item === 20) return null;
  const parts = [
    exclusion !== 20 ? `حد استبعاد العطاء (±${exclusion}%)` : '',
    item !== 20 ? `حد الفقرة غير المتوازنة (${item}%)` : ''
  ].filter(Boolean).join('، و');
  return (
    <p className="mt-2">
      واعتمدت اللجنة {parts}، استناداً إلى ({basis?.trim() || <span className="inline-block w-24 border-b border-dotted border-slate-500"></span>}).
    </p>
  );
};
