import React, { useState } from 'react';
import { ScanSearch } from 'lucide-react';
import { readingReliability } from '../utils/readingReliability';
import type { Bidder } from '../types/tender';

interface ReadingReliabilityCardProps {
  bidder: Bidder;
  onConfirm: (index: number) => void;
}

const SHOWN = 8;

// بطاقة موثوقية القراءة (عرض فقط، بلا أثر في أي حساب): ما يُطابَق بالورقة أولاً، وما عدّلته اللجنة بعد القراءة
export const ReadingReliabilityCard: React.FC<ReadingReliabilityCardProps> = ({ bidder, onConfirm }) => {
  const [all, setAll] = useState(false);
  const rel = readingReliability(bidder);
  if (!rel) return null;
  const risky = rel.riskRows.length > 0;
  const rows = all ? rel.riskRows : rel.riskRows.slice(0, SHOWN);
  const how = rel.engine === 'ai' ? 'آلياً' : rel.engine === 'ocr' ? 'بالقراءة المحلية' : 'آلياً (بأكثر من محرك)';
  return (
    <section
      aria-label="موثوقية قراءة العطاء"
      className={`rounded-xl border px-3 py-2 text-xs ${risky ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
    >
      <p className="font-bold flex items-start gap-2">
        <ScanSearch className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          قُرئ هذا العطاء {how} ({rel.readRows} فقرة).
          {risky && ` تحتاج مطابقة بالورقة: ${rel.riskRows.length} فقرة.`}
          {` عدّلت اللجنة قراءة ${rel.corrected} فقرة بعد القراءة.`}
        </span>
      </p>
      {risky && (
        <>
          <p className="mt-1 text-amber-800">
            القراءة الآلية للعطاء المكتوب بخط اليد قد تخطئ: طابق الفقرات الأكبر مبلغاً بالورقة أولاً، وإن أمكن اطلب من المجهز نسخة مطبوعة أو ملف Excel.
          </p>
          <ul className="mt-2 space-y-1">
            {rows.map(r => (
              <li key={r.index} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-white/70 px-2 py-1">
                <span className="min-w-0 grow basis-60">
                  <strong>(<bdi>{r.itemNo}</bdi>)</strong> <span title={r.description.length > 40 ? r.description : undefined}>{r.description.length > 40 ? r.description.slice(0, 40) + '…' : r.description}</span>
                  <span className="mx-1" aria-hidden="true">—</span>
                  <bdi className="font-bold">{r.amount.toLocaleString('en-US')}</bdi>
                  <span className="block text-amber-800">{r.reasons.join(' | ')}</span>
                </span>
                {r.canConfirm && (
                  <button
                    type="button"
                    onClick={() => onConfirm(r.index)}
                    aria-label={`طابقتُ الورقة للفقرة ${r.itemNo}`}
                    className="shrink-0 font-bold whitespace-nowrap px-3 py-1 rounded-lg cursor-pointer bg-amber-700 hover:bg-amber-800 text-white transition"
                  >
                    طابقتُ الورقة
                  </button>
                )}
              </li>
            ))}
          </ul>
          {rel.riskRows.length > SHOWN && (
            <button type="button" aria-expanded={all} onClick={() => setAll(v => !v)} className="mt-2 font-bold underline cursor-pointer">
              {all ? 'عرض الأكبر فقط' : `عرض الكل (${rel.riskRows.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
};
