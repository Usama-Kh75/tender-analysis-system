// «مسار التحليل» في تبويب الموقف: ما أُنجز وما بقي ومن ينفّذه، مشتق من حالة المناقصة وسجل تدقيقها.
// لا يُخزَّن ولا يُضاف له حقل، ولا يغيّر statusLog (الموقف الإجرائي يبقى يدوياً تحته). عرض فقط.
import type { AuditLogEntry, TenderProject } from '../types/tender';
import { localDate } from './localDate';
import { tenderPath } from './tenderPath';

export type PathState = 'done' | 'current' | 'pending';
export type PathActor = 'النظام' | 'اللجنة';
export interface PathStep {
  text: string;
  state: PathState;
  actor: PathActor;
  /** YYYY-MM-DD إن عُرف من receivedAt أو سجل التدقيق */
  date?: string;
}
export interface PathStage { title: string; steps: PathStep[] }

const logDate = (logs: AuditLogEntry[], match: RegExp): string | undefined => {
  for (let i = logs.length - 1; i >= 0; i--) {
    if (!match.test(logs[i].action)) continue;
    const d = new Date(logs[i].timestamp);
    return Number.isNaN(d.getTime()) ? undefined : localDate(d);
  }
  return undefined;
};

export function analysisPath(p: TenderProject): PathStage[] {
  const path = tenderPath(p);
  const logs = p.auditLogs ?? [];
  const { entered, registered, expected } = path.bids;
  const statusRecorded = !!p.statusLog && p.statusLog.length > 0;
  const hasBids = entered > 0;
  const allEntered = registered > 0 && entered === registered;

  type Draft = { text: string; ok: boolean; actor: PathActor; date?: string };
  const stages: { title: string; drafts: Draft[] }[] = [
    {
      title: 'الاستلام والإدخال',
      drafts: [
        { text: 'استلام العطاءات', ok: !!p.receivedAt || hasBids, actor: 'اللجنة', date: p.receivedAt },
        { text: 'إدخال الكلفة التخمينية', ok: path.hasEstimate, actor: 'اللجنة' },
        { text: `إدخال العطاءات (${entered} من ${expected})`, ok: allEntered, actor: 'اللجنة' }
      ]
    },
    {
      title: 'التدقيق الحسابي',
      drafts: [
        { text: 'الفحص الحسابي الآلي للفقرات', ok: hasBids, actor: 'النظام' },
        {
          text: path.audit.pending > 0
            ? `قرارات اللجنة على الفقرات المعلّمة (${path.audit.pending} متبقية)`
            : 'قرارات اللجنة على الفقرات المعلّمة',
          ok: hasBids && path.audit.pending === 0,
          actor: 'اللجنة',
          date: hasBids && path.audit.pending === 0 ? logDate(logs, /اعتماد|تصحيح خطأ الضرب|تصحيح قراءة/) : undefined
        }
      ]
    },
    {
      title: 'التحليل والتوصية',
      drafts: [
        { text: 'ترتيب العطاءات', ok: hasBids && path.hasEstimate && path.audit.pending === 0, actor: 'النظام' },
        {
          text: path.award ? `اختيار الإحالة (${path.award.name})` : 'اختيار الإحالة',
          ok: !!path.award,
          actor: 'اللجنة',
          date: path.award ? logDate(logs, /تحديث حالة العطاء/) : undefined
        },
        { text: 'معاينة المحضر وطباعته', ok: !!path.award && statusRecorded, actor: 'اللجنة' }
      ]
    }
  ];

  // أول خطوة غير منجزة في المسار كله هي الحالية، وما بعدها ينتظر
  let currentTaken = false;
  return stages.map(stage => ({
    title: stage.title,
    steps: stage.drafts.map(d => {
      const state: PathState = d.ok ? 'done' : currentTaken ? 'pending' : 'current';
      if (!d.ok) currentTaken = true;
      return { text: d.text, state, actor: d.actor, ...(d.date ? { date: d.date } : {}) };
    })
  }));
}
