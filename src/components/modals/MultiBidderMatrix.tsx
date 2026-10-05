import React, { useState } from 'react';
import {
  X,
  Users2,
  Plus,
  Trash2
} from 'lucide-react';
import { TenderProject, Bidder } from '../../types/tender';
import { formatPercent, formatCurrency } from '../../utils/calculations';
import { hasBidAmounts, hasNoEstimate, isCommerciallyExcluded } from '../../utils/recommendation';

interface MultiBidderMatrixProps {
  isOpen: boolean;
  onClose: () => void;
  project: TenderProject;
  onSelectBidder: (id: string) => void;
  onAddNewBidder: (name: string) => void;
  onUpdateBidderStatus: (bidderId: string, status: Bidder['status']) => void;
  onDeleteBidder: (bidderId: string) => void;
}

export const MultiBidderMatrix: React.FC<MultiBidderMatrixProps> = ({
  isOpen,
  onClose,
  project,
  onSelectBidder,
  onAddNewBidder,
  onUpdateBidderStatus,
  onDeleteBidder
}) => {
  const [newBidderName, setNewBidderName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  if (!isOpen) return null;

  // الترتيب نفسه في خلاصة الترسية: من لها مبالغ أولاً، والمستبعد (بقرار اللجنة أو بالانحراف) بعدها،
  // ثم الأقل مبلغاً. كان الترتيب بأقرب انحراف إلى الصفر، فقبل الكلفة التخمينية (كل الانحرافات صفر)
  // تصير أول شركة في القائمة «الأفضل سعرياً» ولو كانت بلا مبالغ
  const noEstimate = hasNoEstimate(project);
  const isOut = (b: Bidder) => b.status === 'disqualified' || isCommerciallyExcluded(b, project.deviationThreshold);
  const sortedBidders = [...project.bidders].sort((a, b) =>
    Number(!hasBidAmounts(a)) - Number(!hasBidAmounts(b))
    || Number(isOut(a)) - Number(isOut(b))
    || a.totals.totalBidderAmount - b.totals.totalBidderAmount
  );
  const bestId = sortedBidders.find(b => hasBidAmounts(b) && !isOut(b))?.id;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBidderName.trim()) return;
    onAddNewBidder(newBidderName.trim());
    setNewBidderName('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Users2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                مصفوفة المقارنة الشاملة للمناقصين والعطاءات
                <span className="bg-indigo-500/30 text-indigo-300 text-xs px-2 py-0.5 rounded-full font-mono">
                  {project.bidders.length} شركات
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                مقارنة العطاءات مع الكلفة التخمينية، وترتيب الأفضلية وتحديد التوصية
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm">
              جدول المقارنة وترتيب العطاءات:
            </h3>

            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                إضافة مجهز جديد
              </button>
            ) : (
              <form onSubmit={handleAdd} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="اسم المجهز / الشركة..."
                  value={newBidderName}
                  onChange={(e) => setNewBidderName(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none w-56"
                  autoFocus
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  حفظ
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
              </form>
            )}
          </div>

          {/* تمرير أفقي بدل القص: عمود «إجراءات» كان يُقص على اليسار حين تظهر أعمدة الانحراف كلها */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-xs">
            <table className="w-full text-xs sm:text-sm text-right border-collapse">
              <thead className="bg-slate-800 text-white font-bold">
                <tr>
                  <th className="p-3 w-12 text-center">الترتيب</th>
                  <th className="p-3 min-w-[180px]">اسم المجهز / الشركة</th>
                  <th className="p-3 text-center">إجمالي مبلغ العرض</th>
                  <th className="p-3 text-center">فرق المبلغ</th>
                  <th className="p-3 text-center">الانحراف الكلي %</th>
                  <th className="p-3 text-center">الانحراف الجزئي %</th>
                  <th className="p-3 text-center">الفقرات المنحرفة</th>
                  <th className="p-3 text-center">النسبة السعرية</th>
                  <th className="p-3 text-center">حالة العطاء</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {sortedBidders.map((bidder, index) => {
                  const isActive = bidder.id === project.activeBidderId;
                  const isFirst = bidder.id === bestId;
                  const isEmpty = !hasBidAmounts(bidder);
                  // قبل الكلفة التخمينية أو لشركة بلا مبالغ: «—» بدل أصفار خضراء توحي بالمطابقة
                  const noAnalysis = noEstimate || isEmpty;

                  return (
                    <tr 
                      key={bidder.id}
                      className={`hover:bg-slate-50 transition ${
                        isActive ? 'bg-indigo-50/50 font-semibold' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        {isEmpty ? (
                          <span className="text-slate-400 font-bold">—</span>
                        ) : isFirst ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-black text-xs border border-amber-300">
                            {index + 1}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-bold">{index + 1}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          {bidder.name}
                          {isFirst && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              {noEstimate ? 'الأقل مبلغاً' : 'الأفضل سعرياً'}
                            </span>
                          )}
                          {isEmpty && (
                            <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              بلا مبالغ بعد
                            </span>
                          )}
                          {isActive && (
                            <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              النشط حالياً
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {bidder.commercialRecord || 'سجل تجاري قيد التدقيق'}
                        </div>
                      </td>
                      <td className="p-3 text-center font-extrabold text-indigo-700">
                        {formatCurrency(bidder.totals.totalBidderAmount, project.currency)}
                      </td>
                      {noAnalysis ? (
                        <td colSpan={5} className="p-3 text-center text-xs font-bold text-slate-400">
                          {isEmpty ? '— لم تُدخل مبالغ هذه الشركة —' : '— بانتظار الكلفة التخمينية —'}
                        </td>
                      ) : (<>
                      <td className={`p-3 text-center font-bold ${
                        bidder.totals.overallDiffAmount > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {formatCurrency(bidder.totals.overallDiffAmount, project.currency)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-xs ${
                          Math.abs(bidder.totals.totalDeviationPercent) > project.deviationThreshold
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {formatPercent(bidder.totals.totalDeviationPercent)}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold text-amber-700">
                        {bidder.totals.partialDeviationPercent.toFixed(2)}%
                      </td>
                      <td className="p-3 text-center font-bold text-rose-700">
                        {bidder.totals.deviatedItemsCount} فقرة
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-purple-700">
                        {bidder.totals.overallPriceRatio.toFixed(4)}
                      </td>
                      </>)}
                      <td className="p-3 text-center">
                        <select
                          value={bidder.status}
                          onChange={(e) => onUpdateBidderStatus(bidder.id, e.target.value as any)}
                          className="bg-slate-100 border border-slate-300 rounded px-2 py-1 text-xs font-semibold focus:outline-none cursor-pointer"
                        >
                          <option value="pending">قيد التدقيق</option>
                          <option value="qualified">مؤهل فنياً ومالياً</option>
                          <option value="recommended">موصى بالترسية</option>
                          <option value="disqualified">مستبعد</option>
                        </select>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              onSelectBidder(bidder.id);
                              onClose();
                            }}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-2.5 py-1 rounded transition cursor-pointer"
                          >
                            عرض وتعديل
                          </button>
                          <button
                            onClick={() => onDeleteBidder(bidder.id)}
                            disabled={project.bidders.length <= 1}
                            title="حذف هذا المجهز نهائياً"
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
};
