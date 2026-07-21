/**
 * Builds the human-readable Telegram alert text.
 */

function formatAlert({ pairKey, timeframeKey, offsetMin, evalResult, closeDT }) {
  const arrow = evalResult.direction === "bearish" ? "🔻" : "🟢";
  const bias = evalResult.direction === "bearish" ? "BEARISH continuation" : "BULLISH continuation";
  const status = evalResult.bodyConfirms
    ? "✅ Body CONFIRMED beyond FVG — high-quality rejection"
    : evalResult.wickOnly
    ? "⚠️ Wick only — body still inside the zone (watch closely)"
    : "⏳ Trading inside the zone — outcome not yet clear";

  const closeLocal = closeDT.toFormat("ccc dd LLL, HH:mm 'NY'");

  return (
    `${arrow} *${pairKey}* — *${timeframeKey.toUpperCase()}* FVG rebalance\n\n` +
    `Bias: *${bias}*\n` +
    `${status}\n\n` +
    `Zone: ${evalResult.zoneLow} – ${evalResult.zoneHigh}\n` +
    `Current price: ${evalResult.liveClose}\n` +
    `Candle closes: ${closeLocal} (in ~${offsetMin} min)\n\n` +
    `_Check the chart — this is a heads-up, not a final signal._`
  );
}

module.exports = { formatAlert };
