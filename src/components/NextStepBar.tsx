import React from 'react';
import { nextStep, type NextStepAction } from '../utils/tenderPath';
import type { TenderProject } from '../types/tender';

interface NextStepBarProps {
  project: TenderProject;
  onGo: (a: NextStepAction) => void;
}

// «الخطوة التالية» تحت عنوان المناقصة: خطوة واحدة تُستنتج من حالة المناقصة ولا يُخزَّن شيء.
// الكهرماني لعمل معلّق (الكلفة، التدقيق، العطاءات)، والحيادي لما بعده (التوصية، المحضر).
export const NextStepBar: React.FC<NextStepBarProps> = ({ project, onGo }) => {
  const step = nextStep(project);
  if (!step) return null;
  const pendingWork = step.kind === 'estimate' || step.kind === 'audit' || step.kind === 'bids';
  const tone = pendingWork
    ? 'bg-amber-50 border-amber-200 text-amber-900'
    : 'bg-slate-50 border-slate-200 text-slate-700';
  const btn = pendingWork
    ? 'bg-amber-700 hover:bg-amber-800 text-white'
    : 'bg-slate-700 hover:bg-slate-800 text-white';
  return (
    <nav aria-label="الخطوة التالية" className={`mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border px-3 py-2 text-xs ${tone}`}>
      <span className="font-bold min-w-0 grow basis-60">{step.text}</span>
      <span className="flex shrink-0 items-center gap-2">
        {step.actions.map(a => (
          <button
            type="button"
            key={a.label}
            onClick={() => onGo(a)}
            className={`font-bold whitespace-nowrap px-3 py-1.5 rounded-lg cursor-pointer transition ${btn}`}
          >
            {a.label}
          </button>
        ))}
      </span>
    </nav>
  );
};
