export function normalizeTradingSymbol(
  rawSymbol: string | null | undefined,
  fallback = "BTCUSDT"
) {
  const symbol = (
    rawSymbol ||
    fallback
  )
    .trim()
    .toUpperCase();

  if (
    !/^[A-Z0-9]{2,20}USDT$/.test(
      symbol
    )
  ) {
    return fallback;
  }

  return symbol;
}