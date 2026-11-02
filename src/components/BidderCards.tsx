import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { TenderProject } from '../types/tender';
import { bidderAuditState } from '../utils/tenderPath';

interface BidderCardsProps {
  project: TenderProject;
  activeBidderId: string;
  onSelect: (id: string) => void;
  onRename: (name: string) => void;
  onAdd: () => void;
}

// الشركات بطاقات، وعلى كل بطاقة حالة تدقيقها: ✓ مدقَّق (أخضر) أو N بانتظار قرار (كهرماني) أو لم تُدخل أسعاره
export const BidderCards: React.FC<BidderCardsProps> = ({ project, activeBidderId, onSelect, onRename, onAdd }) => {
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState('');

  const commitRename = (current: string) => {
    onRename(tempName.trim() || current);
    setEditing(false);
  };

  return (
    <div className="flex flex-wrap items-stretch gap-3 mb-4">
      {project.bidders.map(b => {
        const active = b.id === activeBidderId;
        const state = bidderAuditState(b);
        return (
          <div
            key={b.id}
            className={`rounded-2xl border bg-white px-4 py-2.5 min-w-[170px] transition ${
              active ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-slate-400'
            }`}
          >
            {active && editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(b.name);
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  className="bg-white border border-blue-400 rounded-lg px-2 py-1 text-sm font-black text-slate-900 focus:outline-none ring-2 ring-blue-500/20 w-44"
                  autoFocus
                />
                <button onClick={() => commitRename(b.name)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer">
                  حفظ
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelect(b.id)}
                  aria-pressed={active}
                  className="text-right flex-1 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-black text-slate-900">{b.name}</span>
                    {b.status === 'recommended' && (
                      <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-full px-1.5">★ موصى بالترسية</span>
                    )}
                    {b.status === 'disqualified' && (
                      <span className="text-[10px] font-black text-rose-800 bg-rose-50 border border-rose-300 rounded-full px-1.5">مستبعد</span>
                    )}
                  </div>
                  <div className={`text-xs font-bold mt-0.5 ${
                    state.kind === 'done' ? 'text-emerald-700' : state.kind === 'pending' ? 'text-amber-700' : 'text-slate-500'
                  }`}>
                    {state.kind === 'done' ? '✓ مدقَّق' : state.kind === 'pending' ? `${state.count} بانتظار قرار` : 'لم تُدخل أسعاره'}
                  </div>
                </button>
                {active && (
                  <button
                    onClick={() => { setTempName(b.name); setEditing(true); }}
                    className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title="تعديل اسم الشركة"
                    aria-label="تعديل اسم الشركة"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={onAdd}
        className="rounded-2xl border-2 border-dashed border-slate-300 hover:border-slate-500 text-slate-600 hover:text-slate-900 text-sm font-bold px-4 py-2.5 cursor-pointer transition"
        title="إضافة شركة / مقاول جديد للمناقصة"
      >
        ＋ شركة
      </button>
    </div>
  );
};
