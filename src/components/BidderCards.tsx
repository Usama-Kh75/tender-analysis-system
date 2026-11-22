import React, { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import type { TenderProject } from '../types/tender';
import { bidderAuditState, tenderPath } from '../utils/tenderPath';
import { hasBidAmounts } from '../utils/recommendation';
import { errorsCountText } from '../utils/arabicCount';
import { formatNumber } from '../utils/calculations';
import { bidExpiry } from '../utils/bidValidity';
import { formatSheetDate } from '../utils/orderStatus';

interface BidderCardsProps {
  project: TenderProject;
  activeBidderId: string;
  onSelect: (id: string) => void;
  onRename: (name: string) => void;
  onAdd: () => void;
  /** فتح نافذة نفاذية العطاء للمجهز */
  onEditValidity: (bidderId: string) => void;
}

// الشركات في قائمة منسدلة (الاسم — المبلغ — حالة التدقيق) وتحتها سطر ملخص للمختارة: المبلغ بعد التدقيق، الحالة (أخضر مدقّق، كهرماني فيها أخطاء، رمادي لم يُدخل)، وشارتا الترسية والاستبعاد
export const BidderCards: React.FC<BidderCardsProps> = ({ project, activeBidderId, onSelect, onRename, onAdd, onEditValidity }) => {
  // الشركة الجاري تعديل اسمها (بمعرّفها): لا يتسرب التعديل إلى بطاقة أخرى عند اختيارها
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  // بعد الحفظ أو الإلغاء يعود التركيز إلى زر تعديل الاسم (معرّف الشركة)، ولا يُنفَّذ الإنهاء مرتين (Enter ثم blur)
  const editButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusBackId = useRef<string | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (focusBackId.current && editingId === null) {
      editButtons.current[focusBackId.current]?.focus();
      focusBackId.current = null;
    }
  }, [editingId]);

  // refocus=false عند الخروج من الحقل بالنقر أو Tab (blur): لا يُسحب التركيز من حيث ذهب المستخدم (مراجعة Kimi 2026-11-19)
  const finishRename = (id: string, current: string, save: boolean, refocus = true) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const next = tempName.trim();
    if (save && next && next !== current) onRename(next);
    setEditingId(null);
    if (refocus) focusBackId.current = id;
  };

  // blur الحاوية (يرتفع من الحقل والزر): الخروج إلى خارجها يحفظ بلا سحب التركيز؛ والانتقال بين الحقل و«حفظ» (Tab أو النقر) لا يُنهي التعديل،
  // وإلا أُزيل الزر قبل وصول التركيز إليه. وEscape على الحاوية يلغي من الحقل أو الزر (مراجعة Antigravity 2026-11-19)
  const leaveEdit = (e: React.FocusEvent<HTMLElement>, id: string, current: string) => {
    const to = e.relatedTarget;
    if (to instanceof Node && e.currentTarget.contains(to)) return;
    finishRename(id, current, true, false);
  };

  // عدّاد العطاءات: أخضر حين تكتمل مبالغ كل المسجّلين. المستلمة قد تزيد على المحلَّلة بحق (العطاء غير المستوفي لا يُحلَّل)
  const bids = tenderPath(project).bids;
  const complete = bids.registered > 0 && bids.entered === bids.registered;
  const counterText = bids.expected > bids.entered && complete
    ? `المحلَّلة تجارياً: ${bids.entered} من (${bids.expected}) مستلمة`
    : `العطاءات المدخلة: ${bids.entered} من ${bids.expected}`;
  // نص الحالة ولونها للشركة (من bidderAuditState)
  const stateText = (b: TenderProject['bidders'][number]) => {
    const st = bidderAuditState(b);
    return st.kind === 'done' ? '✓ مدقّق' : st.kind === 'pending' ? errorsCountText(st.count) : 'لم يُدخل';
  };
  const optionText = (b: TenderProject['bidders'][number]) => {
    const amount = hasBidAmounts(b) ? `${formatNumber(b.totals.totalBidderAmount)} ${project.currency}` : 'لم تُدخل أسعاره بعد';
    return `${b.name}${b.status === 'disqualified' ? ' (مستبعد)' : ''} — ${amount} — ${stateText(b)}${b.status === 'recommended' ? ' — ★ موصى بالترسية' : ''}`;
  };
  const active = project.bidders.find(b => b.id === activeBidderId);
  const activeState = active ? bidderAuditState(active) : null;

  return (
    <>
    <p
      className={`mb-2 inline-block text-xs font-black rounded-full px-3 py-1 border ${
        complete ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-50 text-slate-700 border-slate-300'
      }`}
    >
      {counterText}
    </p>
    <div className="mb-4 bg-white rounded-2xl border border-slate-200 px-3 py-2">
      <div className="flex items-center gap-2">
        <label htmlFor="bidder-select" className="text-sm font-black text-slate-700 shrink-0">المجهز:</label>
        {active && editingId === active.id ? (
          <div
            className="flex flex-1 min-w-0 max-w-2xl items-center gap-2"
            onKeyDown={(e) => { if (e.key === 'Escape') finishRename(active.id, active.name, false); }}
            onBlur={(e) => leaveEdit(e, active.id, active.name)}
          >
            <input
              id="bidder-select"
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); finishRename(active.id, active.name, true); } }}
              className="bg-white border border-blue-400 rounded-lg px-2 py-1 text-sm font-black text-slate-900 focus:outline-none ring-2 ring-blue-500/20 min-w-0 flex-1"
              aria-label="اسم الشركة"
              autoFocus
            />
            <button onClick={() => finishRename(active.id, active.name, true)} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer">
              حفظ
            </button>
          </div>
        ) : (
          <>
            <select
              id="bidder-select"
              value={activeBidderId}
              onChange={(e) => onSelect(e.target.value)}
              aria-label="المجهز: اختيار الشركة المتقدمة"
              className="flex-1 min-w-0 max-w-2xl bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              {project.bidders.map(b => (
                <option key={b.id} value={b.id}>{optionText(b)}</option>
              ))}
            </select>
            {active && (
              <button
                ref={(el) => { editButtons.current[active.id] = el; }}
                onClick={() => { finishedRef.current = false; setTempName(active.name); setEditingId(active.id); }}
                className="shrink-0 p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="تعديل اسم الشركة"
                aria-label={`تعديل اسم ${active.name}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
        {active && (
          <button
            type="button"
            onClick={() => onEditValidity(active.id)}
            className="shrink-0 px-3 py-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg cursor-pointer transition"
            title="مدة نفاذية العطاء وتمديدها (المادة 13/أولاً)"
          >
            نفاذية العطاء
          </button>
        )}
        <button
          onClick={() => onAdd()}
          className="shrink-0 px-3 py-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg cursor-pointer transition"
          title="إضافة شركة / مقاول جديد للمناقصة"
        >
          + مجهز
        </button>
      </div>
      {active && activeState && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-bold text-slate-800">
            {hasBidAmounts(active)
              ? <><bdi className="font-mono">{formatNumber(active.totals.totalBidderAmount)}</bdi> <span className="text-slate-500 text-xs">{project.currency}</span></>
              : <span className="text-slate-500 text-xs">لم تُدخل أسعاره بعد</span>}
          </span>
          <span className={`text-xs font-bold ${
            activeState.kind === 'done' ? 'text-emerald-700' : activeState.kind === 'pending' ? 'text-amber-700' : 'text-slate-500'
          }`}>
            {stateText(active)}
          </span>
          {active && bidExpiry(project, active) && (
            <span className="text-xs font-bold text-slate-600">
              {active.validityExtendedTo ? 'ممدَّد لغاية' : 'نافذ لغاية'} <bdi className="font-mono">{formatSheetDate(bidExpiry(project, active)!)}</bdi>
            </span>
          )}
          {active.status === 'recommended' && (
            <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-full px-1.5">★ موصى بالترسية</span>
          )}
          {active.status === 'disqualified' && (
            <span className="text-[10px] font-black text-rose-800 bg-rose-50 border border-rose-300 rounded-full px-1.5">مستبعد</span>
          )}
        </div>
      )}
    </div>
    </>
  );
};
