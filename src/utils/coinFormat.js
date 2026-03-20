/** 竞猜币展示：固定 1 位小数 */
export function formatCoins(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0.0';
  return (Math.round(x * 10) / 10).toFixed(1);
}

/** 从结算明细推算本局净盈亏（与后端 computeBetNetResult 一致；用于历史旧数据订正展示） */
export function netFromBetDetails(details) {
  if (!details || !details.length) return null;
  const raw = details.reduce(
    (s, d) => s + (d.won || 0) + (d.refund || 0) - (d.lost || 0),
    0
  );
  return Math.round(raw * 10) / 10;
}
