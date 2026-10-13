// كشف إضافة متصفح تعدّل نصوص الصفحة من خارج React، كمترجم التمرير TransOver (يلفّ النص بـ transover/transblock
// ثم يستبدل عقدة النص بأخرى) والترجمة المدمجة في Chrome (تلفّه بـ font). React يبقى ممسكاً بالعقدة المستبدلة:
// فيتعطل العرض كله عند إدراج عنصر بجوارها (شاشة بيضاء بعد «إلغاء الاعتماد» ← «اعتماد العرض»، 2026-10-14)،
// أو يحدّث العقدة المحذوفة فيبقى الرقم الظاهر قديماً

let seen = false;

/** وُجد في هذه الجلسة عنصر أضافته إضافة متصفح داخل التطبيق */
export function foreignDomSeen(): boolean {
  return seen;
}

/** عنصر لا يُنشئه التطبيق: وسم غير معروف (transover…)، أو وسم مخصص، أو font الترجمة */
export function isForeignElement(node: Node): boolean {
  if (!(node instanceof Element)) return false;
  return node.tagName === 'FONT' || node.tagName.includes('-') || node instanceof HTMLUnknownElement;
}

/** يراقب root حتى أول عنصر غريب فيُبلغ عنه مرة ويتوقف. يعيد دالة الإيقاف */
export function watchForeignDom(root: Element, onFound: () => void): () => void {
  if (seen) { onFound(); return () => {}; }
  if (typeof MutationObserver === 'undefined') return () => {};
  const observer = new MutationObserver(records => {
    // السجلات تحتفظ بالعقد المضافة ولو أزالتها الإضافة بعد لحظة، كما يفعل TransOver
    if (!records.some(r => Array.from(r.addedNodes).some(isForeignElement))) return;
    seen = true;
    observer.disconnect();
    onFound();
  });
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
