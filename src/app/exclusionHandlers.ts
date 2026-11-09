import { addAuditLog } from '../utils/storageService';
import { formatSheetDate } from '../utils/orderStatus';
import { cleanExclusionReasons, cleanTechnicalOpinion, reasonLabel } from '../utils/exclusionReasons';
import type { ExclusionReason, TechnicalOpinion, TenderProject } from '../types/tender';

// وصف مصدر الرأي الفني في سجل التدقيق
const describeOpinion = (o?: TechnicalOpinion): string => {
  if (!o) return 'محذوف';
  const date = formatSheetDate(o.letterDate);
  return [o.source ?? 'بلا مصدر', o.letterNo && `كتاب رقم (${o.letterNo})`, date && `بتاريخ ${date}`].filter(Boolean).join('، ');
};

/**
 * أسباب استبعاد عطاء (ضوابط رقم (4) سادساً وسابعاً) ومصدر الرأي الفني للمناقصة: سجل وطباعة فقط، لا تغيّر الحالة
 * ولا أي حساب أو ترتيب. تُبنى من المناقصة وقت العرض.
 */
export function createExclusionHandlers(project: TenderProject, saveProject: (p: TenderProject) => void) {
  // technicalOpinion القيمة النهائية للمناقصة (النافذة تمرر الحالية حين لا يظهر قسمه)
  const handleSaveExclusionReasons = (bidderId: string, reasons: ExclusionReason[], technicalOpinion?: TechnicalOpinion): void => {
    const bidder = project.bidders.find(b => b.id === bidderId);
    if (!bidder) return;
    const nextReasons = cleanExclusionReasons(reasons) ?? [];
    const nextOpinion = cleanTechnicalOpinion(technicalOpinion);
    const reasonsChanged = JSON.stringify(cleanExclusionReasons(bidder.exclusionReasons) ?? []) !== JSON.stringify(nextReasons);
    const opinionChanged = JSON.stringify(cleanTechnicalOpinion(project.technicalOpinion)) !== JSON.stringify(nextOpinion);
    if (!reasonsChanged && !opinionChanged) return;

    // كل سبب بتسميته ومتطلبه وتفصيله، فتغيير التفصيل وحده يظهر في السجل (ملاحظة مراجعة Codex)
    const describe = (rs: ExclusionReason[]) => rs.length
      ? rs.map(r => `${reasonLabel(r)}${r.detail ? `: ${r.detail}` : ''}`).join('؛ ') : 'بلا أسباب';
    const prevReasons = cleanExclusionReasons(bidder.exclusionReasons) ?? [];
    const details = `عطاء (${bidder.name}): ${describe(nextReasons)}`
      + (reasonsChanged && prevReasons.length ? ` — وكانت: ${describe(prevReasons)}` : '')
      + (opinionChanged ? ` — ومصدر الرأي الفني: ${describeOpinion(nextOpinion)}` : '');

    const updated: TenderProject = {
      ...project,
      bidders: project.bidders.map(b => {
        if (b.id !== bidderId) return b;
        const { exclusionReasons: _old, ...rest } = b;
        void _old;
        return nextReasons.length ? { ...rest, exclusionReasons: nextReasons } : rest;
      }),
      updatedAt: new Date().toISOString()
    };
    if (nextOpinion) updated.technicalOpinion = nextOpinion; else delete updated.technicalOpinion;
    saveProject(addAuditLog(updated, 'أسباب الاستبعاد', details, {
      bidderId,
      oldValue: { reasons: prevReasons, technicalOpinion: cleanTechnicalOpinion(project.technicalOpinion) },
      newValue: { reasons: nextReasons, technicalOpinion: nextOpinion }
    }));
  };

  return { handleSaveExclusionReasons };
}
