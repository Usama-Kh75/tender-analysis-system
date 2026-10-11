import React from 'react';
import { EstimateMergePlan } from '../utils/estimateMerge';

const SHOWN = 8;
const MAX_NOS = 20;

const Nos: React.FC<{ nos: string[] }> = ({ nos }) => (
  <bdi>{nos.slice(0, MAX_NOS).join('، ')}{nos.length > MAX_NOS ? ` و(${nos.length - MAX_NOS}) غيرها` : ''}</bdi>
);

// ما سيفعله إدراج جدول الكلفة التخمينية في الجدول القائم، قبل الإدراج: المطابقة برقم الفقرة (الناقص والمكرر
// والزائد)، والكميات والأوصاف التي ستحل محل ما في الجدول. الكلفة التخمينية تضعهما، فقراءة خاطئة لكمية
// تُظهر خطأ ضرب على المجهز (1150 بدل 1155 في 2026-10-11)
export const EstimateMergeNotice: React.FC<{ plan: EstimateMergePlan | null }> = ({ plan }) => {
  const fmt = (n: string | number) => typeof n === 'number' ? n.toLocaleString('en-US') : n;
  const structural = !!plan && (plan.missing.length + plan.duplicates.length + plan.extras.length + plan.unnumbered) > 0;
  const changes = !!plan && (plan.quantityChanges.length + plan.descriptionChanges.length) > 0;
  const heading = !plan || (!structural && !changes) ? ''
    : structural ? 'لم تتطابق القراءة مع فقرات الجدول كلها' : 'الإدراج سيغيّر كميات أو أوصافاً في الجدول';
  return (
    <>
      {/* منطقة إعلان دائمة لقارئ الشاشة: منطقة تُدرج مع محتواها قد لا يُعلن عنها */}
      <div role="status" className="sr-only">{heading}</div>
      {plan && (structural || changes) && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs leading-relaxed space-y-2">
          {structural && (
            <div>
              <div className="font-black">⚠️ طوبقت القراءة مع الجدول برقم الفقرة ({plan.matched} فقرة)، ولم تتطابق كلها:</div>
              <ul className="mt-0.5 space-y-0.5 font-bold">
                {plan.missing.length > 0 && <li>({plan.missing.length}) فقرة لم تُقرأ، فيبقى تخمينيها القائم: <Nos nos={plan.missing} /></li>}
                {plan.duplicates.length > 0 && <li>({plan.duplicates.length}) رقم قُرئ أكثر من مرة، فلا يُدرج أي منها: <Nos nos={plan.duplicates} /></li>}
                {plan.extras.length > 0 && <li>({plan.extras.length}) فقرة ليست في الجدول، فتُضاف في آخره: <Nos nos={plan.extras} /></li>}
                {plan.unnumbered > 0 && <li>({plan.unnumbered}) صف بلا رقم فقرة، فلا يُدرج</li>}
              </ul>
              <div className="mt-0.5">قد تكون فقرة سقطت عند القراءة أو قُرئ رقمها خطأً، فطابقها مع الأصل.</div>
            </div>
          )}
          {plan.quantityChanges.length > 0 && (
            <div>
              <div className="font-black">⚠️ ({plan.quantityChanges.length}) فقرة ستتغير كميتها إلى كمية الكلفة التخمينية</div>
              <div className="mt-0.5">الكمية مشتركة مع المجهزين ويُعاد فحص ضربهم بها. إن كانت القراءة هي الخاطئة فصحّح الكمية قبل الإدراج أو في الجدول بعده.</div>
              <ul className="mt-0.5 space-y-0.5 font-bold">
                {plan.quantityChanges.slice(0, SHOWN).map((c, i) => (
                  <li key={i}>الفقرة <bdi>{c.itemNo}</bdi>: <bdi>{fmt(c.from)}</bdi> في الجدول، و<bdi>{fmt(c.to)}</bdi> في الكلفة التخمينية</li>
                ))}
                {plan.quantityChanges.length > SHOWN && <li>و({plan.quantityChanges.length - SHOWN}) فقرة غيرها.</li>}
              </ul>
            </div>
          )}
          {plan.descriptionChanges.length > 0 && (
            <details>
              <summary className="font-black cursor-pointer">({plan.descriptionChanges.length}) فقرة سيحل وصف الكلفة التخمينية محل وصفها</summary>
              <ul className="mt-1 space-y-1">
                {plan.descriptionChanges.map((c, i) => (
                  <li key={i}>
                    <span className="font-bold">الفقرة <bdi>{c.itemNo}</bdi>:</span> «<bdi>{c.from}</bdi>» ← «<bdi>{c.to}</bdi>»
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </>
  );
};
