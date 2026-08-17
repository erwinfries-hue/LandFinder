export function formatChf(value: number): string {
  const sign = value < 0 ? "-" : "";
  const digits = Math.round(Math.abs(value)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return sign + grouped;
}
