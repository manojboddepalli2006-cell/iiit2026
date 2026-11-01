export const money = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
export const compactMoney = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(v);
export const pct = (v: number, d = 2) => `${(v * 100).toFixed(d)}%`;
