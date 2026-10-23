import type { BudgetType } from '../types/tender';
import { formatPercent } from './calculations';
import type { LegalKey } from './legalTexts';

/**
 * نوع الموازنة التي أُدرجت فيها المناقصة: يحدد صلاحية قبول العطاء الذي يزيد على الكلفة التخمينية.
 */
export const BUDGET_TYPES: Record<BudgetType, { label: string }> = {
  investment: { label: 'استثمارية' },
  operating: { label: 'تشغيلية' }
};

export const BUDGET_TYPE_ORDER: BudgetType[] = ['operating', 'investment'];

/**
 * معلومات النوع، أو undefined لنوع غير محدد أو غير معروف (يأتي من localStorage أو نسخة احتياطية،
 * فلا يُفهرس الجدول مباشرة).
 */
export function budgetTypeInfo(type?: string): { label: string } | undefined {
  return type && Object.hasOwn(BUDGET_TYPES, type) ? BUDGET_TYPES[type as BudgetType] : undefined;
}

/**
 * ملاحظة صلاحية قبول العطاء الموصى به إن زاد مبلغه على الكلفة التخمينية — ضوابط رقم (2) رابعاً (ص53–54):
 *  - 1/أ (استثمارية): قبول ما لا يزيد على (10%) مع إعلام وزارة التخطيط لتعديل الكلفة.
 *  - 1/ب (استثمارية): من (10 – 20%) بموافقة المجلس الوزاري المختص من خلال وزارة التخطيط.
 *  - 2 (تشغيلية): قبول ما لا يزيد على (10%) عند توفر السيولة من التخصيص المرصد، وإلا مفاتحة وزارة المالية.
 * deviationPercent هو totals.totalDeviationPercent الموقّع للعطاء الموصى به، ويُقارَن بقيمته لا بالمقرّبة.
 * null: لا زيادة، أو زيادة خارج النص (استثمارية فوق 20%). 'missing': النوع غير محدد فلا يُطبع شيء ويُذكَّر على الشاشة.
 * وهي صلاحية قبول لا توصية بالتفاوض، فالتفاوض يبقى للمادة 13/ثالثاً/ب.
 */
export function budgetApprovalNote(
  type: string | undefined,
  deviationPercent: number
): { kind: 'missing' } | { kind: 'note'; text: string; ref: LegalKey } | null {
  const d = deviationPercent;
  if (!(d > 0)) return null;
  const info = budgetTypeInfo(type);
  if (!info) return { kind: 'missing' };
  const pct = formatPercent(d, 2, 10).replace('+', '');

  // الصياغة تذكر رقم الفقرة ولا تعيد صياغة حكمها؛ نصها الرسمي في قائمة النصوص المطبوعة (قرار 2026-10-23)
  if (type === 'investment') {
    if (d <= 10) {
      return { kind: 'note', ref: 'ann2_4_1a', text: 'ولعدم زيادة مبلغ العطاء على الكلفة التخمينية بأكثر من (10%) يقع قبوله ضمن صلاحية رئيس جهة التعاقد أو من يخوله، مع إعلام وزارة التخطيط، وفق ضوابط رقم (2) رابعاً/1/أ.' };
    }
    if (d <= 20) {
      return { kind: 'note', ref: 'ann2_4_1b', text: `ولزيادة مبلغ العطاء على الكلفة التخمينية بنسبة (${pct}) ضمن (10 – 20%) يُشترط لقبوله استحصال موافقة المجلس الوزاري المختص على الإحالة من خلال وزارة التخطيط، وفق ضوابط رقم (2) رابعاً/1/ب.` };
    }
    return null;
  }

  if (d <= 10) {
    return { kind: 'note', ref: 'ann2_4_2', text: 'ولعدم تجاوز زيادة مبلغ العطاء على الكلفة التخمينية نسبة (10%) يقع قبوله ضمن صلاحية رئيس جهة التعاقد أو من يخوله عند توفر السيولة من التخصيص المالي المرصد، وفق ضوابط رقم (2) رابعاً/2.' };
  }
  return { kind: 'note', ref: 'ann2_4_2', text: `ولزيادة مبلغ العطاء على الكلفة التخمينية بنسبة (${pct}) يُصار إلى مفاتحة وزارة المالية لاستحصال الموافقات على زيادة التخصيص، وفق ضوابط رقم (2) رابعاً/2.` };
}
