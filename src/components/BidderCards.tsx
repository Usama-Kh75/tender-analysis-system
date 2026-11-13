import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { TenderProject } from '../types/tender';
import { bidderAuditState, tenderPath } from '../utils/tenderPath';
import { hasBidAmounts } from '../utils/recommendation';
import { errorsCountText } from '../utils/arabicCount';
import { formatNumber } from '../utils/calculations';

interface BidderCardsProps {
  project: TenderProject;
  activeBidderId: string;
  onSelect: (id: string) => void;
  onRename: (name: string) => void;
  onAdd: () => void;
}

// الشركات قائمة بعرض الصفحة: الاسم، المبلغ بعد التدقيق، حالة التدقيق (أخضر مدقّق، كهرماني فيها أخطاء، رمادي لم يُدخل)، وشارة الترسية
export const BidderCards: React.FC<BidderCardsProps> = ({ project, activeBidderId, onSelect, onRename, onAdd }) => {
  // الشركة الجاري تعديل اسمها (بمعرّفها): لا يتسرب التعديل إلى بطاقة أخرى عند اختيارها
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const commitRename = (current: string) => {
    onRename(tempName.trim() || current);
    setEditingId(null);
  };

  // عدّاد العطاءات: أخضر حين تكتمل مبالغ كل المسجّلين. المستلمة قد تزيد على المحلَّلة بحق (العطاء غير المستوفي لا يُحلَّل)
  const bids = tenderPath(project).bids;
  const complete = bids.entered === bids.registered;
  const counterText = bids.expected > bids.entered && complete
    ? `المحلَّلة تجارياً: ${bids.entered} من (${bids.expected}) مستلمة`
    : `العطاءات المدخلة: ${bids.entered} من ${bids.expected}`;
  return (
    <>
    <p
      className={`mb-2 inline-block text-xs font-black rounded-full px-3 py-1 border ${
        complete ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-50 text-slate-700 border-slate-300'
      }`}
    >
      {counterText}
    </p>
    <div role="list" aria-label="الشركات المتقدمة" className="mb-4 bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
      {project.bidders.map(b => {
        const active = b.id === activeBidderId;
        const state = bidderAuditState(b);
        return (
          <div
            key={b.id}
            role="listitem"
            className={`flex items-center gap-2 px-3 py-1 transition ${active ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
          >
            {active && editingId === b.id ? (
              <div className="flex items-center gap-2 py-1.5">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(b.name);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="bg-white border border-blue-400 rounded-lg px-2 py-1 text-sm font-black text-slate-900 focus:outline-none ring-2 ring-blue-500/20 w-56"
                  aria-label="اسم الشركة"
                  autoFocus
                />
                <button onClick={() => commitRename(b.name)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer">
                  حفظ
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onSelect(b.id)}
                  aria-current={active ? 'true' : undefined}
                  className={`grid flex-1 min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_auto] items-center gap-3 py-2 text-right cursor-pointer border-r-4 pr-2 ${active ? 'border-blue-600' : 'border-transparent'}`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-black text-slate-900 truncate">{b.name}</span>
                    {b.status === 'disqualified' && (
                      <span className="text-[10px] font-black text-rose-800 bg-rose-50 border border-rose-300 rounded-full px-1.5 shrink-0">مستبعد</span>
                    )}
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {hasBidAmounts(b)
                      ? <><bdi className="font-mono">{formatNumber(b.totals.totalBidderAmount)}</bdi> <span className="text-slate-500 text-xs">{project.currency}</span></>
                      : <span className="text-slate-500 text-xs">لم تُدخل أسعاره بعد</span>}
                  </span>
                  <span className={`text-xs font-bold ${
                    state.kind === 'done' ? 'text-emerald-700' : state.kind === 'pending' ? 'text-amber-700' : 'text-slate-500'
                  }`}>
                    {state.kind === 'done' ? '✓ مدقّق' : state.kind === 'pending' ? errorsCountText(state.count) : 'لم يُدخل'}
                  </span>
                  <span className="min-w-[7rem]">
                    {b.status === 'recommended' && (
                      <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-full px-1.5">★ موصى بالترسية</span>
                    )}
                  </span>
                </button>
                {active && (
                  <button
                    onClick={() => { setTempName(b.name); setEditingId(b.id); }}
                    className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title="تعديل اسم الشركة"
                    aria-label={`تعديل اسم ${b.name}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}

      <div role="listitem">
        <button
          onClick={onAdd}
          className="w-full text-right px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer transition"
          title="إضافة شركة / مقاول جديد للمناقصة"
        >
          + مجهز
        </button>
      </div>
    </div>
    </>
  );
};
