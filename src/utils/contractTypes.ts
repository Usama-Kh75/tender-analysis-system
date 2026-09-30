import type { ContractType } from '../types/tender';

/**
 * ما يختلف بين أنواع العقود في التوصية التجارية: معايير المفاضلة عند تساوي الأسعار
 * أو تقاربها لغاية 1% من الكلفة التخمينية — ضوابط رقم (5)، وأمثلتها منقولة من النص الرسمي.
 * قاعدة الاستبعاد ±20% والإحالة للتفاوض وإعادة الإعلان عامة لكل الأنواع.
 */
export interface ContractTypeInfo {
  label: string;
  /** فقرة معايير المفاضلة الخاصة بالنوع في ضوابط رقم (5) */
  preferenceClause: string;
  /** أمثلة معايير المفاضلة كما وردت في الفقرة */
  preferenceExamples: string;
}

export const CONTRACT_TYPES: Record<ContractType, ContractTypeInfo> = {
  works: {
    label: 'أشغال (مقاولات عامة)',
    preferenceClause: 'ثانياً/2',
    preferenceExamples: 'مدة العقد، أو مدة الصيانة، أو أية مبادرات أخرى'
  },
  supply: {
    label: 'تجهيز',
    preferenceClause: 'ثالثاً/2',
    preferenceExamples: 'خدمات ما بعد البيع الإضافية، أو مدة الصيانة، أو مدة الضمان، أو أية مبادرات أخرى'
  },
  services: {
    label: 'خدمات غير استشارية',
    preferenceClause: 'رابعاً/2',
    preferenceExamples: 'مدة العقد، أو تقديم الخدمات لمدة إضافية خارج مدة العقد، أو أية مبادرات أخرى'
  }
};

export const CONTRACT_TYPE_ORDER: ContractType[] = ['works', 'supply', 'services'];

/** مرجع معايير المفاضلة بحسب النوع، أو بصيغة عامة إن لم يُحدد النوع */
export function preferenceReference(type?: ContractType): { clause: string; examples: string } {
  if (type) {
    const info = CONTRACT_TYPES[type];
    return { clause: `ضوابط رقم (5) ${info.preferenceClause}`, examples: info.preferenceExamples };
  }
  return {
    clause: 'ضوابط رقم (5)',
    examples: 'مدة العقد، أو مدة الصيانة، أو الضمان، أو خدمات ما بعد البيع، أو المبادرات الأخرى'
  };
}
