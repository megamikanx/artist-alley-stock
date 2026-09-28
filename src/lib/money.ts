export function money(value: string | number) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "0.00";
  return amount.toFixed(2);
}

export function splitFee(fee: string | number, artistCount: number) {
  if (artistCount <= 0) return 0;
  return Number(fee) / artistCount;
}
