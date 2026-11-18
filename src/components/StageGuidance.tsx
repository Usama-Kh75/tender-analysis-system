import React, { useState } from 'react';
import type { TenderProject } from '../types/tender';
import { stageGuidance } from '../utils/stageGuidance';
import { LEGAL_TEXTS, type LegalKey } from '../utils/legalTexts';

// «ما تقرره التعليمات هنا»: بطاقة مطوية بالمواد المنطبقة في المرحلة المفتوحة. عرض فقط، ولا تُطبع.
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

const Body: React.FC<{ project: TenderProject; tab: string }> = ({ project, tab }) => {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<LegalKey | null>(null);
  const items = stageGuidance(project, tab);
  if (items.length === 0) return null;
  const listId = `stage-guidance-${tab}`;
  return (
    <section aria-label="ما تقرره التعليمات هنا" className="no-print print:hidden mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(o => !o)}
        className={`flex w-full items-center justify-between gap-2 font-bold text-slate-800 cursor-pointer rounded ${focus}`}
      >
        <span>ما تقرره التعليمات هنا ({items.length})</span>
        <span aria-hidden="true" className={`text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <ul id={listId} className="mt-2 space-y-2">
          {items.map(({ key, ruling }) => {
            const t = LEGAL_TEXTS[key];
            const on = shown === key;
            return (
              <li key={key}>
                <span className="font-semibold text-slate-800">{ruling}</span>{' '}
                <span className="text-slate-600">({t.label})</span>{' '}
                <button
                  type="button"
                  aria-expanded={on}
                  onClick={() => setShown(on ? null : key)}
                  className={`font-bold text-blue-800 underline cursor-pointer rounded ${focus}`}
                >
                  {on ? 'إخفاء النص' : 'النص الرسمي'}
                </button>
                {on && (
                  <blockquote className="mt-1 rounded-lg bg-slate-50 px-3 py-2 leading-relaxed text-slate-700">
                    «{t.text}» (ص {t.page})
                  </blockquote>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

// المفتاح يعيد البطاقة مطوية عند تبديل المناقصة أو التبويب
export const StageGuidance: React.FC<{ project: TenderProject; activeTab: string }> = ({ project, activeTab }) => (
  <Body key={`${project.id}-${activeTab}`} project={project} tab={activeTab} />
);
