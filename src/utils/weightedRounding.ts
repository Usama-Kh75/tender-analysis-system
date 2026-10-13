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

  return {
    rows: items.map((_, k) => ({ unitPrice: unit[k] / 100, amount: amount[k] / 100, adjustment: moved[k] / 100 })),
    total: amount.reduce((s, c) => s + c, 0) / 100,
    residual: residual / 100
  };
}
