export function money(value: string | number) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "0.00";
  return amount.toFixed(2);
}
