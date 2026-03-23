/** 竞猜币展示：固定 1 位小数 */
export function formatCoins(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0.0';
  return (Math.round(x * 10) / 10).toFixed(1);
}

/**
 * 从结算明细推算本局净盈亏（与后端 computeBetNetResult 一致）。
 * 注意：won 为猜中后入账总额（含返还本金×赔率），不是纯利润，不能简单 sum(won)。
 */
export function netFromBetDetails(details) {
  if (!details || !details.length) return null;
  let sum = 0;
  for (const d of details) {
    const stake = d.amount || 0;
    if (d.refund != null && d.refund > 0) {
      sum += d.refund - stake;
    } else if (d.won != null && d.won > 0) {
      sum += d.won - stake;
    } else if (d.lost) {
      sum -= d.lost;
    }
  }
  return Math.round(sum * 10) / 10;
}
