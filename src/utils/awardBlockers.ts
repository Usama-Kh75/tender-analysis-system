import type { Bidder, TenderProject } from '../types/tender';
import { buildRecommendation } from './recommendation';
import { preferenceReference } from './contractTypes';
import { isCommitteeCorrected } from './bidderAuditEngine';
import { unresolvedEmptyBidders } from './exclusionReasons';
import { hasCompletePreferenceRecord } from './preferenceBasis';
import type { LegalKey } from './legalTexts';

// موانع الترسية عند «اختيار للترسية»: دالة نقية، عرض فقط، لا تغيّر حساباً ولا ترتيباً (docs/superpowers/specs/2026-11-19-award-blockers-design.md)

export interface PendingErrorsBlock {
  kind: 'pendingErrors';
  legalKey: LegalKey;
  /** العطاءات المؤهلة التي فيها فقرات أخطاؤها لم تبتّ فيها اللجنة، بعدد كل منها */
  bidders: { id: string; name: string; count: number }[];
  firstBidderId: string;
}
export interface EmptyBiddersBlock { kind: 'emptyBidders'; bidders: Bidder[] }
export type Blocker = PendingErrorsBlock | EmptyBiddersBlock;

export interface PreferenceJustification {
  kind: 'preference';
  legalKey?: LegalKey;
  clause: string;
  /** met: لكل عطاء متقارب سجل مكتمل، فلا يُعرض في النافذة */
  met: boolean;
  bids: { id: string; name: string; complete: boolean }[];
}
export interface NotLowestJustification { kind: 'notLowest'; legalKey: LegalKey; lowest: Bidder }
export type Justification = PreferenceJustification | NotLowestJustification;

export interface ReadCheckWarning { kind: 'readCheck'; count: number }
export type Warning = ReadCheckWarning;

export interface AwardBlockers { blocks: Blocker[]; justify: Justification[]; warnings: Warning[] }

const pendingErrorRows = (b: Bidder): number =>
  b.items.filter(i => (i.hasMathError || i.hasTextDiscrepancy) && !i.unpriced && !isCommitteeCorrected(i)).length;

const readCheckRows = (b: Bidder): number =>
  b.items.filter(i => i.readCheck && !i.unpriced && !isCommitteeCorrected(i)).length;

export function awardBlockers(project: TenderProject, bidderId: string): AwardBlockers {
  const rec = buildRecommendation(project);
  const blocks: Blocker[] = [];
  const justify: Justification[] = [];
  const warnings: Warning[] = [];

  // خامساً/ب/6: التصحيح لجميع العطاءات لتحديد التسلسل، فالمانع في أي عطاء مؤهل لا في المختار وحده
  const withErrors = rec.eligible.map(b => ({ id: b.id, name: b.name, count: pendingErrorRows(b) })).filter(e => e.count > 0);
  if (withErrors.length > 0) {
    blocks.push({ kind: 'pendingErrors', legalKey: 'ann4_5_b6', bidders: withErrors, firstBidderId: withErrors[0].id });
  }

  const empty = unresolvedEmptyBidders(project);
  if (empty.length > 0) blocks.push({ kind: 'emptyBidders', bidders: empty });

  const chosenInClose = rec.closeBids.length > 1 && rec.closeBids.some(b => b.id === bidderId);
  if (chosenInClose) {
    const pref = preferenceReference(project.contractType);
    const bids = rec.closeBids.map(b => ({ id: b.id, name: b.name, complete: hasCompletePreferenceRecord(project, b.id) }));
    justify.push({ kind: 'preference', legalKey: pref.legalKey, clause: pref.clause, met: bids.every(b => b.complete), bids });
  }

  const lowest = rec.eligible[0];
  if (lowest && rec.eligible.some(b => b.id === bidderId) && lowest.id !== bidderId && !chosenInClose) {
    justify.push({ kind: 'notLowest', legalKey: 'art10_1_h', lowest });
  }

  const readCheck = rec.eligible.reduce((n, b) => n + readCheckRows(b), 0);
  if (readCheck > 0) warnings.push({ kind: 'readCheck', count: readCheck });

  return { blocks, justify, warnings };
}

/** هل يعرض الاختيار نافذة (مانع أو مبرر غير مستوفى أو تنبيه)؟ */
export const needsAwardDialog = (a: AwardBlockers): boolean =>
  a.blocks.length > 0 || a.justify.some(j => j.kind !== 'preference' || !j.met) || a.warnings.length > 0;
