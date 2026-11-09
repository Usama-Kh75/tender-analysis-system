import { addAuditLog } from '../utils/storageService';
import { formatSheetDate } from '../utils/orderStatus';
import { cleanExclusionReasons, cleanTechnicalOpinion, exclusionLabels } from '../utils/exclusionReasons';
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

    const labels = exclusionLabels({ ...bidder, status: 'disqualified', exclusionReasons: nextReasons });
    const details = `عطاء (${bidder.name}): ${nextReasons.length ? labels : 'بلا أسباب'}`
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
    saveProject(addAuditLog(updated, 'أسباب الاستبعاد', details, { bidderId }));
  };

  return { handleSaveExclusionReasons };
}
