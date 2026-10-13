/**
 * الأسعار الموزونة (ضوابط رقم (4) سادساً/5): مفرد كل فقرة = النسبة السعرية × مبلغها التخميني ÷ كميتها، مقرّباً
 * لمنزلتين، ومبلغها = الكمية × المفرد. تقريب كل فقرة على حدة يترك فرقاً عن مبلغ العطاء، فيُسوّى بتحريك مفرد بعض
 * الفقرات 0.01 بجولات: كل جولة من الأكبر كمية إلى الأصغر، وتُحرَّك الفقرة إن لم يتجاوز أثرها الباقي. الأكبر أولاً
 * يقلل الفقرات المحرّكة، والصغيرة تكمل الفلوس الأخيرة. ما يتعذر يبقى في residual ويظهر صراحة.
 * الحساب بالفلس (أعداد صحيحة) لتفادي كسور الفاصلة العائمة. بلا import كي تستعملها calculations.ts دون دوران
 */
export interface WeightedInput { quantity: number; estimatedTotal: number }
export interface WeightedRow { unitPrice: number; amount: number; adjustment: number }
export interface WeightedPrices { rows: WeightedRow[]; total: number; residual: number }

const toCents = (v: number) => Math.round(v * 100);
const MAX_ROUNDS = 1000;
const MAX_PAIR_ROUNDS = 5000;

export function settleWeightedPrices(items: WeightedInput[], ratio: number, target: number): WeightedPrices {
  const priced = (i: WeightedInput) => i.estimatedTotal > 0 && i.quantity > 0;
  const unit = items.map(i => priced(i) ? toCents(ratio * i.estimatedTotal / i.quantity) : 0);
  const amount = items.map((i, k) => priced(i) ? Math.round(i.quantity * unit[k])
    : i.estimatedTotal > 0 ? toCents(ratio * i.estimatedTotal) : 0);
  const moved = items.map(() => 0);
  let residual = ratio > 0 ? toCents(target) - amount.reduce((s, c) => s + c, 0) : 0;

  const order = items.map((_, k) => k).filter(k => priced(items[k]))
    .sort((a, b) => items[b].quantity - items[a].quantity || a - b);
  for (let round = 0; residual !== 0 && round < MAX_ROUNDS; round++) {
    let progressed = false;
    for (const k of order) {
      if (residual === 0) break;
      const step = Math.sign(residual);
      if (unit[k] + step < 0) continue;
      const delta = Math.round(items[k].quantity * (unit[k] + step)) - amount[k];
      if (delta === 0 || Math.sign(delta) !== step || Math.abs(delta) > Math.abs(residual)) continue;
      unit[k] += step;
      amount[k] += delta;
      moved[k] += step;
      residual -= delta;
      progressed = true;
    }
    if (!progressed) break;
  }

  // جولات الفلس الواحد لا تصل إلى فرق كبير تمتصه فقرات صغيرة الكمية وحدها، فيُمسح الباقي بخطوات أكبر:
  // كل فقرة تُحرَّك بأكبر عدد من الفلوس لا يتجاوز أثره الباقي (الأكبر كمية أولاً)
  for (const k of order) {
    if (residual === 0) break;
    const step = Math.sign(residual);
    // النقصان لا يتجاوز المفرد القائم (لا يُنزَّل تحت الصفر)، فلا تطول الحلقة بكميات كسرية صغيرة
    // +1: المبلغ يُقرَّب (Math.round)، فقد لا يبلغ الباقي إلا بخطوة تزيد على القسمة الصحيحة
    const most = Math.max(1, Math.ceil(Math.abs(residual) / items[k].quantity) + 1);
    for (let take = step < 0 ? Math.min(most, unit[k]) : most; take >= 1; take--) {
      const delta = Math.round(items[k].quantity * (unit[k] + step * take)) - amount[k];
      if (delta === 0 || Math.sign(delta) !== step || Math.abs(delta) > Math.abs(residual)) continue;
      unit[k] += step * take;
      amount[k] += delta;
      moved[k] += step * take;
      residual -= delta;
      break;
    }
  }

  // كميات كبيرة متقاربة: أثر كل فلس على مبلغ فقرة بحجم كميتها فلا تقترب منفردةً من فلس واحد، لكن تحريك متعاكس
  // لفقرتين (+0.01 على إحداهما و−0.01 على الأخرى) يصنع فرقاً صغيراً بينهما (1651 − 1650 = 1 فلس). كل جولة تختار
  // أقرب تحريكة (منفردة أو زوج) إلى الباقي، وتُقبل فقط إن قرّبته من الصفر فتنتهي الحلقة
  for (let round = 0; residual !== 0 && round < MAX_PAIR_ROUNDS; round++) {
    const ups: { k: number; d: number }[] = [];
    const downs: { k: number; d: number }[] = [];
    for (const k of order) {
      ups.push({ k, d: Math.round(items[k].quantity * (unit[k] + 1)) - amount[k] });
      if (unit[k] >= 1) downs.push({ k, d: Math.round(items[k].quantity * (unit[k] - 1)) - amount[k] });
    }
    downs.sort((a, b) => a.d - b.d);

    let best: { gap: number; up?: { k: number; d: number }; down?: { k: number; d: number } } = { gap: Math.abs(residual) };
    const consider = (net: number, up?: { k: number; d: number }, down?: { k: number; d: number }) => {
      const gap = Math.abs(residual - net);
      if (gap < best.gap) best = { gap, up, down };
    };
    for (const u of ups) consider(u.d, u);
    for (const v of downs) consider(v.d, undefined, v);
    for (const u of ups) {
      // أقرب هبوط إلى (الباقي − أثر الصعود): بحث ثنائي ثم جيران يمنة ويسرة لتخطي الفقرة نفسها
      const want = residual - u.d;
      let lo = 0;
      let hi = downs.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (downs[mid].d < want) lo = mid + 1; else hi = mid;
      }
      for (let j = Math.max(0, lo - 2); j <= Math.min(downs.length - 1, lo + 1); j++) {
        if (downs[j].k !== u.k) consider(u.d + downs[j].d, u, downs[j]);
      }
    }
    if (best.gap >= Math.abs(residual)) break;
    let net = 0;
    if (best.up) { unit[best.up.k] += 1; amount[best.up.k] += best.up.d; moved[best.up.k] += 1; net += best.up.d; }
    if (best.down) { unit[best.down.k] -= 1; amount[best.down.k] += best.down.d; moved[best.down.k] -= 1; net += best.down.d; }
    residual -= net;
  }

  return {
    rows: items.map((_, k) => ({ unitPrice: unit[k] / 100, amount: amount[k] / 100, adjustment: moved[k] / 100 })),
    total: amount.reduce((s, c) => s + c, 0) / 100,
    residual: residual / 100
  };
}
