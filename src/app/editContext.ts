import type { Dispatch, SetStateAction } from 'react';
import { addAuditLog } from '../utils/storageService';
import { offerLockReason } from '../utils/weightedOffer';
import { Bidder, TenderProject } from '../types/tender';

// السياق المشترك لمصانع المعالجات: المناقصة والمجهز النشط (غير فارغين) ودوال الحفظ والقفل
export interface EditContext {
  currentProject: TenderProject;
  activeBidder: Bidder;
  setProjects: Dispatch<SetStateAction<TenderProject[]>>;
  saveProject: (updatedProj: TenderProject) => void;
  commitBidder: (bidderId: string, update: (b: Bidder) => Bidder, action: string, details: string, meta?: Parameters<typeof addAuditLog>[3]) => void;
  blockedByOffer: (scope: { bidderId?: string; shared?: boolean }) => boolean;
  fmtNum: (v?: number) => string;
}

export function createEditContext(
  currentProject: TenderProject,
  activeBidder: Bidder,
  setProjects: Dispatch<SetStateAction<TenderProject[]>>
): EditContext {
  const saveProject = (updatedProj: TenderProject) => {
    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  const fmtNum = (v?: number) => v === undefined ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  // تعديل عطاء واحد بلا إعادة حساب (حقول العرض والصفحة والتأشير لا تدخل في calculateBOQMetrics)، مع قيد في السجل
  const commitBidder = (bidderId: string, update: (b: Bidder) => Bidder, action: string, details: string, meta?: Parameters<typeof addAuditLog>[3]) => {
    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: currentProject.bidders.map(b => b.id === bidderId ? update(b) : b),
      updatedAt: new Date().toISOString()
    };
    updatedProj = addAuditLog(updatedProj, action, details, { bidderId, ...meta });
    saveProject(updatedProj);
  };
  // يرفض تعديلاً يغيّر أرقام عطاء له عرض موزون فعّال أو معتمد، برسالة السبب
  const blockedByOffer = (scope: { bidderId?: string; shared?: boolean }) => {
    const reason = offerLockReason(currentProject, scope);
    if (reason) window.alert(reason);
    return !!reason;
  };

  return { currentProject, activeBidder, setProjects, saveProject, commitBidder, blockedByOffer, fmtNum };
}
