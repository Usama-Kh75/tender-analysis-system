import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Flag, Pencil, RotateCcw, Signature } from 'lucide-react';
import { BOQItem, ReadingField } from '../types/tender';
import { readingHint } from '../utils/readingHints';
import { committeeResolvedTextMismatch, hasNumericCommitteeCorrection, isCommitteeCorrected, parseArabicTextToNumber, readMissingThousands, writtenAmountTarget } from '../utils/bidderAuditEngine';

// تصحيح قراءة التفقيط: يُعتمد النص عند مغادرة الحقل أو Enter، وEscape يلغي. يُكتب كما في العطاء ولا
// يُولَّد من الرقم، لأن المكتوب كتابةً هو ما يُعتد به (ضوابط رقم (4) خامساً/ب/1).
// onDone يُبلغ إن انتهى التعديل من لوحة المفاتيح، ليعيد الجدول التركيز إلى زر القلم بدل ضياعه
const WrittenTextInput: React.FC<{ value: string; onCommit: (v: string) => void; onDone: (byKeyboard: boolean) => void }> = ({ value, onCommit, onDone }) => {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  const byKeyboard = useRef(false);
  return (
    <textarea
      autoFocus
      dir="rtl"
      rows={2}
      value={draft}
      aria-label="نص التفقيط كما في العطاء"
      placeholder="المبلغ كتابةً كما في العطاء"
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); byKeyboard.current = true; e.currentTarget.blur(); }
        if (e.key === 'Escape') { cancelled.current = true; byKeyboard.current = true; e.currentTarget.blur(); }
      }}
      onBlur={() => {
        if (!cancelled.current && draft.trim() !== value.trim()) onCommit(draft);
        onDone(byKeyboard.current);
      }}
      className="w-full field-sizing-content min-h-[2.5rem] bg-white border border-indigo-400 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg px-2 py-1 text-[11px] leading-relaxed resize-y"
    />
  );
};

// adding: فقرة بلا تفقيط (أغفلته القراءة، أو مُسح لأنها اختلقته)، فيُضاف كما في العطاء
const EditTextButton: React.FC<{ rowId: string; itemNo: number | string; onClick: () => void; adding?: boolean }> = ({ rowId, itemNo, onClick, adding }) => (
  <button
    type="button"
    onClick={onClick}
    data-edit-text={rowId}
    className="shrink-0 p-0.5 rounded text-slate-500 hover:text-indigo-700 hover:bg-white transition cursor-pointer"
    title={adding
      ? 'إضافة المبلغ كتابةً كما في العطاء إن أغفلته القراءة، فيُعاد فحص الفقرة'
      : 'تصحيح قراءة التفقيط إن خالف نص العطاء، فيُعاد فحص الفقرة'}
    aria-label={`${adding ? 'إضافة التفقيط' : 'تصحيح قراءة التفقيط'} للفقرة ${itemNo}`}
  >
    <Pencil className="w-3 h-3" />
  </button>
);

interface AuditCellProps {
  item: BOQItem;
  index: number;
  editingText: boolean;
  onEditText: (id: string | null) => void;
  onUpdateFields: (index: number, patch: Partial<BOQItem>, logAction?: string) => void;
  onCorrectReading: (index: number, field: ReadingField, value: number | string) => void;
  onAdoptTafqeetThousands: (index: number, correctedText: string) => void;
  onMarkUnreasonable?: (index: number, note: string | null) => void;
  onMarkBidderSigned?: (index: number, signed: boolean) => void;
  onAcceptAsReading?: (index: number) => void;
  onReadingFromPaper?: (index: number, paper: { unitPrice?: number; total?: number }) => void;
  onConfirmReadCheck?: (index: number) => void;
}

// خلية «تدقيق الأخطاء الحسابية والتفقيط» وأزرار قرارات اللجنة فيها (منقولة من BOQTable كما هي)،
// وتظهر في عرض التدقيق وحده
export const AuditCell: React.FC<AuditCellProps> = ({
  item, index, editingText, onEditText, onUpdateFields, onCorrectReading, onAdoptTafqeetThousands,
  onMarkUnreasonable, onMarkBidderSigned, onAcceptAsReading, onReadingFromPaper, onConfirmReadCheck
}) => {
  // زر «الورقة تقول»: ثانوي الشكل، ويُبرز حين يرجّح التلميح أن الرقم المقروء هو الخطأ
  const paperBtn = 'text-[10px] font-black px-2 py-0.5 rounded shadow-2xs transition cursor-pointer';
  return (
                      <div className="space-y-1.5">

                        {/* اختلاف القراءتين: قد يكون خطأ قراءة لا خطأ مجهز، يُحسم بمطابقة الورقة */}
                        {item.readCheck && !item.unpriced && !isCommitteeCorrected(item) && (
                          <div className="bg-amber-50 text-amber-950 border border-amber-300 px-2.5 py-1.5 rounded-lg font-bold flex flex-wrap items-center gap-2 shadow-2xs">
                            <span>اختلفت القراءتان في هذه الفقرة: قد يكون خطأ قراءة. طابقها بالورقة.</span>
                            {onConfirmReadCheck && !item.hasMathError && !item.hasTextDiscrepancy && (
                              <button
                                type="button"
                                onClick={() => onConfirmReadCheck(index)}
                                className="bg-amber-700 hover:bg-amber-800 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-2xs transition cursor-pointer"
                              >
                                طابقتُ الورقة
                              </button>
                            )}
                          </div>
                        )}

                        {/* 1. خطأ الضرب الحسابي (أحمر) */}
                        {item.hasMathError && (
                          <div className="bg-rose-100 text-rose-950 border border-rose-300 px-2.5 py-1.5 rounded-lg font-bold flex flex-col gap-1 shadow-2xs">
                            <div className="flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-black text-rose-900">🚨 خطأ ضرب:</span> المدون في العطاء ({item.enteredBidderTotal?.toLocaleString() || item.bidderTotal.toLocaleString()} د.ع) ≠ حاصل (المفرد <bdi dir="ltr" className="whitespace-nowrap">{item.enteredUnitPrice?.toLocaleString()} × {item.quantity.toLocaleString()} = {((item.enteredUnitPrice || 0) * (item.quantity || 1)).toLocaleString()}</bdi> د.ع)
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 mr-5">
                              <button
                                onClick={() => {
                                  // التصحيح وإزالة العلامة في تعديل واحد: كانا تعديلين فيلغي الثاني الأول،
                                  // فتختفي العلامة ويبقى المبلغ الخاطئ
                                  const mathCorrect = (item.enteredUnitPrice || 0) * (item.quantity || 1);
                                  onUpdateFields(index, { bidderTotal: mathCorrect, hasMathError: false },
                                    'اعتماد تصحيح خطأ الضرب بقرار اللجنة');
                                }}
                                className="bg-rose-700 hover:bg-rose-800 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-2xs transition cursor-pointer"
                                title="تصحيح مبلغ الفقرة لحاصل ضرب المفرد في الكمية"
                              >
                                🔢 اعتماد حاصل الضرب ({((item.enteredUnitPrice || 0) * (item.quantity || 1)).toLocaleString()})
                              </button>
                              {/* استثناء ضوابط رقم (4) خامساً/ب/2: إن رأت اللجنة خطأً فادحاً في العلامة العشرية بسعر المفرد
                                  اعتمدت المبلغ كما هو وصحّحت المفرد. الأصل يُحفظ في originalUnitPrice كاعتماد التفقيط مفرداً */}
                              <button
                                onClick={() => {
                                  const amount = item.enteredBidderTotal || item.bidderTotal;
                                  const qty = item.quantity || 1;
                                  const unit = item.enteredUnitPrice || 0;
                                  if (!(amount > 0)) return;
                                  if (!window.confirm(`استثناء ضوابط رقم (4) خامساً/ب/2: هل ترى اللجنة أن في سعر المفرد المدون (${unit.toLocaleString()}) خطأً فادحاً في العلامة العشرية؟

سيُعتمد مبلغ الفقرة كما دوّنه المجهز (${amount.toLocaleString()}) ويُصحَّح سعر المفرد إلى ${(amount / qty).toLocaleString()}.`)) return;
                                  onUpdateFields(index, {
                                    originalUnitPrice: item.originalUnitPrice ?? unit,
                                    enteredUnitPrice: amount / qty,
                                    bidderUnitPrice: amount / qty,
                                    bidderTotal: amount,
                                    hasMathError: false
                                  }, 'اعتماد المبلغ وتصحيح سعر المفرد لخطأ فادح في العلامة العشرية');
                                }}
                                className="bg-white hover:bg-rose-50 text-rose-900 border border-rose-500 text-[10px] font-black px-2 py-0.5 rounded shadow-2xs transition cursor-pointer"
                                title="استثناء ضوابط رقم (4) خامساً/ب/2: خطأ فادح في العلامة العشرية بسعر المفرد، فيُعتمد المبلغ ويُصحَّح المفرد"
                              >
                                ⚖️ اعتماد المبلغ وتصحيح المفرد (علامة عشرية)
                              </button>
                              {/* الورقة تخالف القراءة: المفرد صحيح والمبلغ قُرئ خطأً، فليس خطأ مجهز */}
                              {onReadingFromPaper && !item.hasTextDiscrepancy && (item.enteredUnitPrice || 0) > 0 && (
                                <button
                                  onClick={() => onReadingFromPaper(index, { total: (item.enteredUnitPrice || 0) * (item.quantity || 1) })}
                                  className={`bg-white hover:bg-rose-50 text-rose-900 border border-slate-400 ${paperBtn}`}
                                  title="طابقتَ الورقة فوجدت المبلغ مكتوباً بحاصل الضرب، وأن القراءة هي التي أخطأت: يُعتمد دون أن يُحسب خطأ مجهز"
                                >
                                  📄 الورقة تقول: المبلغ = <bdi dir="ltr" className="whitespace-nowrap">{(item.quantity || 1).toLocaleString()} × {(item.enteredUnitPrice || 0).toLocaleString()} = {((item.enteredUnitPrice || 0) * (item.quantity || 1)).toLocaleString()}</bdi> (خطأ قراءة)
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 2. تعارض وتناقض التفقيط (برتقالي / كهرماني)
                            المكتوب كتابةً هو المعتمد (ضوابط رقم (4) خامساً/ب/1). التفقيط قد يكون لسعر المفرد فيكون
                            المبلغ حاصل ضربه بالكمية (خامساً/ب/2)، أو لمبلغ الفقرة. الأرقام وحدها لا تحسم أيهما (الرقم
                            المدون نفسه قد يكون الخاطئ)، فحين يحتمل الأمرين يُعرض زران وتختار اللجنة، ويُبرز الأرجح.
                            كان زر واحد يجعل قيمة تفقيط المفرد مبلغاً للفقرة كلها.
                            أثناء تصحيح قراءة التفقيط يحل حقل التعديل محل مربعه (المتعارض أو المطابق)، وتختفي أزرار
                            الاعتماد لأنها مبنية على النص القديم */}
                        {editingText && (
                          <WrittenTextInput
                            value={item.writtenText || ''}
                            onCommit={(v) => onCorrectReading(index, 'writtenText', v)}
                            onDone={(byKeyboard) => {
                              onEditText(null);
                              // بعد Enter أو Escape يعود التركيز إلى زر القلم، وإلا ضاع مع حذف الحقل
                              if (byKeyboard) requestAnimationFrame(() =>
                                document.querySelector<HTMLButtonElement>(`[data-edit-text="${item.id}"]`)?.focus());
                            }}
                          />
                        )}
                        {item.hasTextDiscrepancy && !editingText && (() => {
                          const written = item.writtenText ? parseArabicTextToNumber(item.writtenText) : null;
                          const qty = item.quantity || 1;
                          const unit = item.enteredUnitPrice || 0;
                          const enteredTotal = item.enteredBidderTotal || item.bidderTotal;
                          // كمية 1: المفرد هو المبلغ فلا فرق بين الاعتمادين
                          const ambiguous = written !== null && unit > 0 && qty !== 1;
                          const likelyUnit = ambiguous && writtenAmountTarget(written, unit, enteredTotal) === 'unit';
                          // المفرد المدون رقماً يُحفظ قبل أن يحل محله التفقيط، لجدول واقع الحال ولإلغاء التصحيح
                          const adoptAsUnit = (logAction = 'اعتماد سعر المفرد المكتوب كتابةً بقرار اللجنة') => written && onUpdateFields(index, {
                            originalUnitPrice: item.originalUnitPrice ?? unit,
                            enteredUnitPrice: written,
                            bidderUnitPrice: written,
                            bidderTotal: written * qty,
                            hasTextDiscrepancy: false,
                            hasMathError: false
                          }, logAction);
                          // بلا مفرد مدون يُعتمد المبلغ وحده. ومع مفرد مدون وكمية 1 يُحدَّث المفرد مع المبلغ،
                          // وإلا بقي المفرد القديم فتعيد الكمية بناء المبلغ منه عند تعديلها
                          const adoptAsTotal = () => written && (unit > 0 && qty === 1
                            ? adoptAsUnit('اعتماد المبلغ المكتوب كتابةً بقرار اللجنة')
                            : onUpdateFields(index, { bidderTotal: written, hasTextDiscrepancy: false },
                              'اعتماد المبلغ المكتوب كتابةً بقرار اللجنة'));
                          const solid = 'bg-amber-700 hover:bg-amber-800 text-white';
                          const outline = 'bg-white hover:bg-amber-50 text-amber-900 border border-amber-500';
                          // تلميح خطأ القراءة: الرقم المقروء يطابق ما يقوله التفقيط إلا في ٢/٣ أو في عدد الأصفار
                          const unitHint = ambiguous && written ? readingHint(unit, written) : null;
                          const totalHint = written ? readingHint(enteredTotal, written) : null;
                          const hint = unitHint ?? totalHint;
                          const paperUnitLead = !!unitHint;
                          const paperTotalLead = !unitHint && !!totalHint;
                          const paperClass = (lead: boolean) => `${lead ? solid : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-400'} ${paperBtn}`;
                          // «ثلاثة وخمسمائة» والأرقام 3,500: كلمة «آلاف» ناقصة من خطأ المجهز، لا تعارض بين رقمين
                          const missing = readMissingThousands(item.writtenText, unit, enteredTotal);
                          if (missing) {
                            const matchesUnit = unit > 0 && Math.abs(missing.value - unit) <= 0.01;
                            return (
                            <div className="bg-amber-100 text-amber-950 border border-amber-400 px-2.5 py-1.5 rounded-lg font-bold flex flex-col gap-1 shadow-2xs">
                              <div className="flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <span className="font-black text-amber-900">⚠️ تفقيط ناقص «آلاف»:</span> المكتوب كتابةً ({item.writtenText})
                                  والصواب ({missing.corrected}) = <bdi>{missing.value.toLocaleString()}</bdi> د.ع،
                                  ويوافق {matchesUnit ? 'سعر المفرد' : 'مبلغ الفقرة'} المدون ({(matchesUnit ? unit : enteredTotal).toLocaleString()} د.ع)
                                </div>
                                <EditTextButton rowId={item.id} itemNo={item.itemNo} onClick={() => onEditText(item.id)} />
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1 mr-5">
                                <button
                                  onClick={() => onAdoptTafqeetThousands(index, missing.corrected)}
                                  className={`${solid} text-[10px] font-black px-2 py-0.5 rounded shadow-2xs transition cursor-pointer`}
                                  title="اعتماد التفقيط بعد إضافة «آلاف» الناقصة بقرار اللجنة؛ لا يتغير أي رقم، ويبقى ما كتبه المجهز مسجلاً"
                                >
                                  ⚖️ اعتماد التفقيط (<bdi>{missing.value.toLocaleString()}</bdi>)
                                </button>
                              </div>
                            </div>
                            );
                          }
                          return (
                          <div className="bg-amber-100 text-amber-950 border border-amber-400 px-2.5 py-1.5 rounded-lg font-bold flex flex-col gap-1 shadow-2xs">
                            <div className="flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <span className="font-black text-amber-900">⚠️ تعارض تفقيط:</span> المكتوب كتابةً ({item.writtenText}) يختلف عن {ambiguous
                                  ? <>سعر المفرد المدون ({unit.toLocaleString()} د.ع) وعن مبلغ الفقرة المدون ({enteredTotal.toLocaleString()} د.ع)</>
                                  : <>الرقم المدون ({enteredTotal.toLocaleString()} د.ع)</>}
                              </div>
                              <EditTextButton rowId={item.id} itemNo={item.itemNo} onClick={() => onEditText(item.id)} />
                            </div>
                            {hint && (
                              <div className="mr-5 text-[11px] font-black text-indigo-800">💡 {hint.text}</div>
                            )}
                            {written !== null && written > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 mr-5">
                              {ambiguous ? (<>
                                <button
                                  onClick={() => adoptAsUnit()}
                                  className={`${hint ? outline : likelyUnit ? solid : outline} text-[10px] font-black px-2 py-0.5 rounded shadow-2xs transition cursor-pointer`}
                                  title="التفقيط لسعر المفرد: يُعتمد مفرداً ويُضرب بالكمية، بقرار اللجنة"
                                >
                                  {/* المعادلة باتجاه اليسار ومتصلة: في سياق عربي كانت تنقلب «= 50,300» إلى أول السطر */}
                                  ⚖️ اعتماده سعراً للمفرد (<bdi dir="ltr" className="whitespace-nowrap">{written.toLocaleString()} × {qty.toLocaleString()} = {(written * qty).toLocaleString()}</bdi>)
                                </button>
                                <button
                                  onClick={adoptAsTotal}
                                  className={`${hint ? outline : likelyUnit ? outline : solid} text-[10px] font-black px-2 py-0.5 rounded shadow-2xs transition cursor-pointer`}
                                  title="التفقيط لمبلغ الفقرة: يُعتمد مبلغاً لها، بقرار اللجنة"
                                >
                                  ⚖️ اعتماده مبلغاً للفقرة ({written.toLocaleString()})
                                </button>
                                {onReadingFromPaper && (<>
                                  {(hint ? paperUnitLead : likelyUnit) && (<button
                                    onClick={() => onReadingFromPaper(index, { unitPrice: written, total: written * qty })}
                                    className={paperClass(paperUnitLead)}
                                    title="طابقتَ الورقة فوجدت المفرد مكتوباً كما في التفقيط وأن القراءة هي التي أخطأت: يُعتمد دون أن يُحسب خطأ مجهز"
                                  >
                                    📄 الورقة تقول: المفرد <bdi dir="ltr" className="whitespace-nowrap">{written.toLocaleString()} × {qty.toLocaleString()} = {(written * qty).toLocaleString()}</bdi> (خطأ قراءة)
                                  </button>)}
                                  {(hint ? paperTotalLead : !likelyUnit) && (<button
                                    onClick={() => onReadingFromPaper(index, { total: written })}
                                    className={paperClass(paperTotalLead)}
                                    title="طابقتَ الورقة فوجدت مبلغ الفقرة مكتوباً كما في التفقيط وأن القراءة هي التي أخطأت: يبقى المفرد كما هو"
                                  >
                                    📄 الورقة تقول: المبلغ {written.toLocaleString()} (خطأ قراءة)
                                  </button>)}
                                </>)}
                              </>) : (<>
                                <button
                                  onClick={adoptAsTotal}
                                  className={`${solid} text-[10px] font-black px-2 py-0.5 rounded shadow-2xs transition cursor-pointer`}
                                  title="اعتماد المبلغ المكتوب كتابةً بعد موافقة اللجنة / الإدارة وفق التعليمات"
                                >
                                  ⚖️ اعتماد المكتوب كتابةً بموافقة اللجنة
                                </button>
                                {onReadingFromPaper && (
                                  <button
                                    onClick={() => onReadingFromPaper(index, unit > 0 && qty === 1 ? { unitPrice: written, total: written } : { total: written })}
                                    className={paperClass(paperTotalLead)}
                                    title="طابقتَ الورقة فوجدت المبلغ مكتوباً كما في التفقيط وأن القراءة هي التي أخطأت: يُعتمد دون أن يُحسب خطأ مجهز"
                                  >
                                    📄 الورقة تقول: المبلغ {written.toLocaleString()} (خطأ قراءة)
                                  </button>
                                )}
                              </>)}
                            </div>
                            )}
                          </div>
                          );
                        })()}

                        {/* 3. التفقيط المطابق والسليم (أخضر) */}
                        {/* بعد اعتماد اللجنة (ب/2 أو حاصل الضرب) قد لا يطابق التفقيط الأرقام المعتمدة: بطاقة محايدة لا خضراء */}
                        {item.writtenText && !item.hasTextDiscrepancy && !editingText && (() => {
                          const resolved = committeeResolvedTextMismatch(item);
                          if (!resolved) return null;
                          return (
                            <div className="bg-slate-100 text-slate-800 border border-slate-300 px-2 py-0.5 rounded-lg text-[11px] font-semibold flex items-start gap-1">
                              <AlertTriangle className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
                              <span className="flex-1">
                                <strong className="text-slate-900 font-bold">تفقيط المجهز لا يطابق المعتمد:</strong> {item.writtenText}
                                {' '}(<bdi>{resolved.written.toLocaleString()}</bdi>) — المفرد المعتمد <bdi>{resolved.unit.toLocaleString()}</bdi>،
                                والمبلغ <bdi>{resolved.total.toLocaleString()}</bdi> بقرار اللجنة
                              </span>
                              <EditTextButton rowId={item.id} itemNo={item.itemNo} onClick={() => onEditText(item.id)} />
                            </div>
                          );
                        })()}
                        {item.writtenText && !item.hasTextDiscrepancy && !editingText && !committeeResolvedTextMismatch(item) && (
                          <div className="bg-emerald-50 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="flex-1">
                              <strong className="text-emerald-950 font-bold">{item.originalWrittenText !== undefined ? 'تفقيط معتمد بقرار اللجنة:' : 'تفقيط مطابق:'}</strong> {item.writtenText}
                              {item.originalWrittenText !== undefined && <span className="text-emerald-800"> — كتبه المجهز: ({item.originalWrittenText})</span>}
                            </span>
                            <EditTextButton rowId={item.id} itemNo={item.itemNo} onClick={() => onEditText(item.id)} />
                          </div>
                        )}

                        {/* 4. فقرة بلا مبلغ (لم تُسعَّر في العطاء «-» أو لم تُدخل بعد): ليست «سليمة» بل تُراجع مع الأصل */}
                        {/* في هذا السطر وفي الحالتين 4 و5 لا تفقيط للفقرة: يُتاح إضافته بالقلم، وإلا تعذّر استدراك تفقيط
                            أغفلته القراءة أو مُسح خطأً */}
                        {!item.writtenText && item.hasMathError && !editingText && (
                          <div className="text-slate-500 font-bold flex items-center gap-1 text-[11px]">
                            <span className="flex-1">لا تفقيط مقروء للفقرة</span>
                            <EditTextButton rowId={item.id} itemNo={item.itemNo} adding onClick={() => onEditText(item.id)} />
                          </div>
                        )}
                        {!item.hasMathError && !item.hasTextDiscrepancy && !item.writtenText && item.bidderTotal === 0 && !editingText && (
                          <div className="text-slate-500 font-bold flex items-center gap-1 text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                            {/* unpriced: قرأ الاستخراج «-» في خانة السعر، أي أن العطاء نفسه لم يسعّرها */}
                            <span className="flex-1">{item.unpriced ? 'غير مسعّرة في العطاء («-») — راجِع الأصل' : 'لا مبلغ للمجهز — راجِع العطاء الأصلي'}</span>
                            <EditTextButton rowId={item.id} itemNo={item.itemNo} adding onClick={() => onEditText(item.id)} />
                          </div>
                        )}

                        {/* 5. حالة السليم تماماً عند عدم وجود تفقيط أو أخطاء */}
                        {!item.hasMathError && !item.hasTextDiscrepancy && !item.writtenText && item.bidderTotal !== 0 && !editingText && (
                          <div className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="flex-1">سليم ومطابق حسابياً</span>
                            <EditTextButton rowId={item.id} itemNo={item.itemNo} adding onClick={() => onEditText(item.id)} />
                          </div>
                        )}

                        {/* تأشير سعر غير معقول: خطأ تسعير لا حسابي، للإحاطة والتبليغ فقط */}
                        {onMarkUnreasonable && (item.unreasonablePrice ? (
                          <div className="bg-orange-50 text-orange-900 border border-orange-300 px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-start gap-1">
                            <Flag className="w-3 h-3 text-orange-600 shrink-0 mt-0.5" />
                            <span className="flex-1"><strong>سعر غير معقول:</strong> {item.unreasonablePrice.note}</span>
                            <button type="button" onClick={() => onMarkUnreasonable(index, null)}
                              className="shrink-0 px-1 rounded text-orange-700 hover:bg-white cursor-pointer" aria-label={`إزالة تأشير السعر غير المعقول عن الفقرة ${item.itemNo}`}>✕</button>
                          </div>
                        ) : (
                          <button type="button"
                            onClick={() => {
                              const note = window.prompt(`ملاحظة اللجنة على سعر الفقرة رقم (${item.itemNo})، مثل: «سعر 10 كغم يساوي سعر 350 غم»`);
                              if (note && note.trim()) onMarkUnreasonable(index, note.trim());
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-orange-700 cursor-pointer">
                            <Flag className="w-3 h-3" /> تأشير سعر غير معقول
                          </button>
                        ))}

                        {/* الخطأ في قراءة الورقة لا في المجهز: الأرقام الحالية تصير ما كتبه المجهز */}
                        {onAcceptAsReading && hasNumericCommitteeCorrection(item) && (
                          <button type="button" onClick={() => onAcceptAsReading(index)}
                            title="للحالة التي تكون فيها الأرقام المعتمدة هي المكتوبة فعلاً في الورقة وكانت القراءة هي الخطأ: تصير المدوَّنة ويزول التصحيح الحسابي"
                            className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-700 cursor-pointer">
                            <RotateCcw className="w-3 h-3" /> الأرقام كما في الورقة (خطأ قراءة لا خطأ مجهز)
                          </button>
                        )}

                        {/* توقيع المجهز إزاء تصحيح اللجنة (ضوابط رقم (4) خامساً/ب/3): على الفقرة المصحَّحة وحدها */}
                        {onMarkBidderSigned && isCommitteeCorrected(item) && (item.bidderSignedAt ? (
                          <div className="bg-teal-50 text-teal-900 border border-teal-300 px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-start gap-1">
                            <Signature className="w-3 h-3 text-teal-600 shrink-0 mt-0.5" />
                            <span className="flex-1">وقّع المجهز وختم إزاء التصحيح ({new Date(item.bidderSignedAt).toLocaleDateString('ar-EG')})</span>
                            <button type="button" onClick={() => onMarkBidderSigned(index, false)}
                              className="shrink-0 px-1 rounded text-teal-700 hover:bg-white cursor-pointer" aria-label={`إزالة تأشير توقيع المجهز عن الفقرة ${item.itemNo}`}>✕</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => onMarkBidderSigned(index, true)}
                            title="حضر المجهز ووقّع وختم إزاء تصحيح اللجنة لهذه الفقرة (ضوابط رقم (4) خامساً/ب/3)"
                            className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-teal-700 cursor-pointer">
                            <Signature className="w-3 h-3" /> تأشير توقيع المجهز إزاء التصحيح
                          </button>
                        ))}

                      </div>
  );
};
