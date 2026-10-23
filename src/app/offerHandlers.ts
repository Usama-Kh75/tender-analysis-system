import { calculateBOQMetrics } from '../utils/calculations';
import { startOfferBlocker, offerFieldsFromCorrected, offerFieldsFromFormula, offerUnitPatch, offerStatus,
  pauseOfferPatch, resumeOfferPatch } from '../utils/weightedOffer';
import { exclusionThresholdOf } from '../utils/recommendation';
import { EditContext } from './editContext';

export function createOfferHandlers(ctx: EditContext) {
  const { currentProject, activeBidder, commitBidder, fmtNum } = ctx;

  // بدء العرض الموزون (سادساً/5): من أسعار العطاء بعد التصحيح، أو بالمعادلة، أو استئناف عرض موقوف بتعديلاته
  const handleStartOffer = (origin: 'corrected' | 'formula' | 'resume') => {
    const blocker = startOfferBlocker(activeBidder, exclusionThresholdOf(currentProject));
    if (blocker) { window.alert(blocker); return; }
    const prev = activeBidder.weightedOffer;
    if (origin !== 'resume' && activeBidder.items.some(i => i.offerTotal !== undefined) && !window.confirm(
      'لهذا العطاء تعديلات عرض موزون سابقة، وستُستبدل ببداية جديدة. هل تريد المتابعة؟')) return;
    // الأسعار الموزونة المخزَّنة قد تسبق التسوية الحالية أو تتغيّر أثناء الإيقاف: تُحسب من جديد قبل أخذها نقطة انطلاق
    const fresh = calculateBOQMetrics(activeBidder.items, currentProject.deviationThreshold).items;
    const fields = origin === 'resume' ? fresh.map(it => resumeOfferPatch(it, prev?.origin ?? 'corrected'))
      : origin === 'formula' ? offerFieldsFromFormula(fresh) : offerFieldsFromCorrected(activeBidder.items);
    const bidTotal = activeBidder.totals.totalBidderAmount;
    const label = origin === 'resume' ? 'استئناف العرض الموزون'
      : origin === 'formula' ? 'بدء العرض الموزون بالمعادلة (التخميني × النسبة السعرية)'
      : 'بدء العرض الموزون من أسعار العطاء بعد التصحيح';
    commitBidder(activeBidder.id, b => ({
      ...b,
      items: fields ? b.items.map((it, i) => ({ ...it, ...fields[i] })) : b.items,
      weightedOffer: {
        status: 'active',
        origin: origin === 'resume' ? (prev?.origin ?? 'corrected') : origin,
        startedAt: origin === 'resume' && prev ? prev.startedAt : new Date().toISOString(),
        bidTotal
      }
    }), label, `${label} لعطاء (${activeBidder.name}) — مبلغ العطاء بعد التصحيح (${fmtNum(bidTotal)})`);
  };

  // إيقاف المرحلة لتصحيح قراءة أو غيره: تُحفظ تعديلات العرض وتعود عند الاستئناف، ويسقط الاعتماد إن وُجد
  const handlePauseOffer = () => {
    const offer = activeBidder.weightedOffer;
    if (!offer || offer.status === 'paused') return;
    if (!window.confirm(`إيقاف مرحلة العرض الموزون لعطاء (${activeBidder.name})؟\n\n`
      + 'تُفتح أرقام العطاء للتعديل، وتُحفظ تعديلات العرض لتعود عند الاستئناف'
      + (offer.status === 'adopted' ? '، ويسقط اعتماد العرض الموزون.' : '.'))) return;
    // الفقرات التي لم تُعدَّل تُسقط حقول عرضها فتتبع ما بعد التصحيح إن صُحّحت قراءة أثناء الإيقاف
    commitBidder(activeBidder.id, b => ({
      ...b,
      items: b.items.map(it => ({ ...it, ...pauseOfferPatch(it, offer.origin) })),
      weightedOffer: { ...offer, status: 'paused', adoptedAt: undefined }
    }),
      'إيقاف العرض الموزون', `أُوقفت مرحلة العرض الموزون لعطاء (${activeBidder.name})${offer.status === 'adopted' ? ' وسقط اعتماده' : ''}`);
  };

  const handleAdoptOffer = () => {
    const s = offerStatus(activeBidder);
    if (!s || activeBidder.weightedOffer?.status !== 'active') return;
    if (!s.canAdopt) {
      window.alert(s.stale
        ? 'تغيّر مبلغ العطاء بعد بدء العرض الموزون. أوقف المرحلة ثم استأنفها لتُعاد المطابقة.'
        : `مجموع العرض الموزون (${fmtNum(s.offerSum)}) لا يساوي مبلغ العطاء (${fmtNum(s.bidTotal)}): الفرق (${fmtNum(s.diff)}).`);
      return;
    }
    commitBidder(activeBidder.id, b => ({ ...b, weightedOffer: { ...b.weightedOffer!, status: 'adopted', adoptedAt: new Date().toISOString() } }),
      'اعتماد العرض الموزون', `اعتُمد العرض الموزون لعطاء (${activeBidder.name}) بمجموع (${fmtNum(s.offerSum)}) مساوٍ لمبلغ العطاء، و(${s.editedCount}) فقرة معدّلة`);
  };

  const handleUnadoptOffer = () => {
    if (activeBidder.weightedOffer?.status !== 'adopted') return;
    if (!window.confirm('إلغاء اعتماد العرض الموزون والعودة إلى تعديله؟')) return;
    commitBidder(activeBidder.id, b => ({ ...b, weightedOffer: { ...b.weightedOffer!, status: 'active', adoptedAt: undefined } }),
      'إلغاء اعتماد العرض الموزون', `أُلغي اعتماد العرض الموزون لعطاء (${activeBidder.name})`);
  };

  // تعديل مفرد فقرة في العرض الموزون: طبقة مستقلة، لا تمس ما دوّنه المجهز ولا ما بعد التصحيح
  const handleEditOfferUnit = (index: number, unit: number) => {
    const before = activeBidder.items[index];
    if (!before || activeBidder.weightedOffer?.status !== 'active') return;
    const patch = offerUnitPatch(before, unit);
    commitBidder(activeBidder.id, b => ({ ...b, items: b.items.map((it, i) => i === index ? { ...it, ...patch } : it) }),
      'تعديل بالعرض الموزون',
      `سعر مفرد الفقرة رقم (${before.itemNo}) في العرض الموزون لعطاء (${activeBidder.name}) من (${fmtNum(before.offerUnitPrice)}) إلى (${fmtNum(unit)})، ومبلغها (${fmtNum(patch.offerTotal)})`,
      { itemNo: before.itemNo, oldValue: before.offerUnitPrice, newValue: unit });
  };

  return { handleStartOffer, handlePauseOffer, handleAdoptOffer, handleUnadoptOffer, handleEditOfferUnit };
}
