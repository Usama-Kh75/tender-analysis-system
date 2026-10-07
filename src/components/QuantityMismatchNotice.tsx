import React from 'react';
import { quantityMismatches } from '../utils/bidderAuditEngine';

const SHOWN = 8;

// تنبيه قبل إدراج عطاء مجهز: فقرات كميتها في المصدر تختلف عن كمية الجدول. تبقى كمية الجدول ويُفحص بها الضرب،
// فقد تظهر هذه الفقرات بخطأ ضرب بعد الإدراج، والسبب فرق الكمية لا قراءة المبلغ
export const QuantityMismatchNotice: React.FC<{
  mismatches: ReturnType<typeof quantityMismatches>;
  source: string; // «الملف» أو «العطاء المقروء»
}> = ({ mismatches, source }) => {
  const fmt = (n: number) => n.toLocaleString('en-US');
  const heading = `(${mismatches.length}) فقرة كميتها في ${source} تختلف عن كمية الجدول`;
  return (
    <>
      {/* منطقة إعلان دائمة لقارئ الشاشة: منطقة تُدرج مع محتواها قد لا يُعلن عنها. موضعها مطلق فلا تشغل مكاناً */}
      <div role="status" className="sr-only">{mismatches.length > 0 ? heading : ''}</div>
      {mismatches.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs leading-relaxed">
          <div className="font-black">⚠️ {heading}</div>
          <div className="mt-0.5">
            تبقى كمية الجدول، وهي مشتركة مع الكلفة التخمينية وبقية المجهزين، ويُفحص الضرب بها بعد الإدراج، فقد تظهر هذه الفقرات بخطأ ضرب.
            إن كانت كمية الجدول هي الخاطئة فصحّحها في الجدول بعد الإدراج، فيُعاد فحص الفقرة.
          </div>
          <ul className="mt-1 space-y-0.5 font-bold">
            {mismatches.slice(0, SHOWN).map((m, i) => (
              <li key={i}>
                الفقرة <bdi>{m.itemNo}</bdi>: <bdi>{fmt(m.file)}</bdi> في {source}، و<bdi>{fmt(m.table)}</bdi> في الجدول
              </li>
            ))}
            {mismatches.length > SHOWN && <li>و({mismatches.length - SHOWN}) فقرة غيرها.</li>}
          </ul>
        </div>
      )}
    </>
  );
};
