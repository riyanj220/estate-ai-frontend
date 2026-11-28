/** A short rupee amount for chart labels, in the units buyers use here. The full figure is always written elsewhere. */
export function shortPkr(value: number): string {
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)} crore`;
  if (value >= 1e5) return `${(value / 1e5).toFixed(1)} lakh`;
  return Math.round(value).toLocaleString("en-US");
}
