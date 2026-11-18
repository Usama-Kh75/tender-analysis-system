import React, { useState } from 'react';
import { Scale } from 'lucide-react';
import type { TenderProject } from '../types/tender';
import { stageGuidance } from '../utils/stageGuidance';
import { LEGAL_TEXTS, type LegalKey } from '../utils/legalTexts';

// «ما تقرره التعليمات»: تلميح مفتوح دائماً بالمواد المنطبقة في المرحلة المفتوحة، فوق «الخطوة التالية» فيمهّد لها.
// لونه النيلي للتعليمات وحدها: الكهرماني للعمل المعلّق، والأزرق للتبويب المفتوح. عرض فقط، ولا يُطبع.
// كان بطاقة مطوية، فقال أسامة (2026-11-18): «ربما لا تنتبه إليه اللجنة»، وترك الشكل لرأيي.
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700';

const Body: React.FC<{ project: TenderProject; tab: string }> = ({ project, tab }) => {
  const [shown, setShown] = useState<LegalKey | null>(null);
  const items = stageGuidance(project, tab);
  if (items.length === 0) return null;
  return (
    <section aria-label="ما تقرره التعليمات" className="no-print print:hidden mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs text-indigo-950">
      <h2 className="flex items-center gap-1.5 text-sm font-black text-indigo-900">
        <Scale aria-hidden="true" className="w-4 h-4 shrink-0" />
        ما تقرره التعليمات
      </h2>
      <ul className="mt-1.5 space-y-1.5 list-disc pr-5 marker:text-indigo-700">
        {items.map(({ key, ruling }) => {
          const t = LEGAL_TEXTS[key];
          const on = shown === key;
          return (
            <li key={key} className="leading-relaxed">
              <span className="font-semibold">{ruling}</span>{' '}
              <span className="text-indigo-800">({t.label})</span>{' '}
              <button
                type="button"
                aria-expanded={on}
                aria-controls={on ? `legal-text-${key}` : undefined}
                aria-label={`${on ? 'إخفاء' : 'عرض'} النص الرسمي لـ ${t.label}`}
                onClick={() => setShown(on ? null : key)}
                className={`font-bold text-indigo-800 underline cursor-pointer rounded whitespace-nowrap ${focus}`}
              >
                {on ? 'إخفاء النص' : 'النص الرسمي'}
              </button>
              {on && (
                <blockquote id={`legal-text-${key}`} className="mt-1 rounded-lg border border-indigo-100 bg-white px-3 py-2 leading-relaxed text-slate-700">
                  «{t.text}» (ص {t.page})
                </blockquote>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

// المفتاح يطوي النصوص المفتوحة عند تبديل المناقصة أو التبويب
export const StageGuidance: React.FC<{ project: TenderProject; activeTab: string }> = ({ project, activeTab }) => (
  <Body key={`${project.id}-${activeTab}`} project={project} tab={activeTab} />
);
