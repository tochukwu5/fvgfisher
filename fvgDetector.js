/**
 * Fair Value Gap detection, rebalance tracking, and body-close confirmation.
 *
 * Definitions used (standard 3-candle imbalance / ICT-style FVG), for
 * candles A, B, C in chronological order:
 *
 *   Bearish FVG:
 *     A.low > C.high
 *     zoneHigh = A.low
 *     zoneLow  = C.high
 *   Price rallying back UP into [zoneLow, zoneHigh] is a "rebalance" of a
 *   bearish FVG. Continuation bias = the CLOSING candle's BODY (not just
 *   its wick) ends back below zoneLow.
 *
 *   Bullish FVG (mirror image):
 *     A.high < C.low
 *     zoneLow  = A.high
 *     zoneHigh = C.low
 *   Price selling back DOWN into the zone is a rebalance. Continuation
 *   bias = the closing candle's body ends back above zoneHigh.
 *
 * Only the most recent, still-unmitigated FVG is tracked per symbol/
 * timeframe. An FVG is "mitigated" (no longer tradable) once a CLOSED
 * candle has fully closed all the way through it in the direction of
 * the gap.
 */

/** Scan closed candles for 3-candle imbalance patterns. */
function findFvgs(candles) {
  const fvgs = [];
  // The live (still-forming) candle is excluded from pattern-hunting —
  // an FVG is only valid once fully formed by 3 CLOSED candles.
  const closed = candles.slice(0, -1);

  for (let i = 0; i < closed.length - 2; i++) {
    const a = closed[i];
    const c = closed[i + 2];

    if (a.low > c.high) {
      fvgs.push({
        direction: "bearish",
        zoneHigh: a.low,
        zoneLow: c.high,
        formedAt: c.datetime,
        formedIndex: i + 2,
      });
    } else if (a.high < c.low) {
      fvgs.push({
        direction: "bullish",
        zoneLow: a.high,
        zoneHigh: c.low,
        formedAt: c.datetime,
        formedIndex: i + 2,
      });
    }
  }
  return fvgs;
}

/** True if any CLOSED candle after formation has fully closed through the
 * zone in the direction of the gap (i.e. the gap has been used up). */
function isMitigated(fvg, candles) {
  const closed = candles.slice(0, -1);
  const start = fvg.formedIndex + 1;

  for (let i = start; i < closed.length; i++) {
    const candle = closed[i];
    if (fvg.direction === "bearish" && candle.close < fvg.zoneLow) return true;
    if (fvg.direction === "bullish" && candle.close > fvg.zoneHigh) return true;
  }
  return false;
}

/** Most recent FVG that hasn't yet been fully mitigated by a closed
 * candle — the zone we watch for a rebalance + rejection. */
function getActiveFvg(candles) {
  const fvgs = findFvgs(candles);
  for (let i = fvgs.length - 1; i >= 0; i--) {
    if (!isMitigated(fvgs[i], candles)) return fvgs[i];
  }
  return null;
}

/**
 * Looks at the current, still-forming candle and determines whether it is
 * (a) trading inside/through the FVG zone (a rebalance), and (b) currently
 * on track to close with its BODY beyond the zone in the continuation
 * direction. Returns a result object if the setup is live, else null.
 */
function evaluateLiveCandle(fvg, candles) {
  const live = candles[candles.length - 1];

  let wickedIntoZone, bodyConfirms, wickOnly;

  if (fvg.direction === "bearish") {
    wickedIntoZone = live.high >= fvg.zoneLow;
    bodyConfirms = live.close < fvg.zoneLow;
    wickOnly = wickedIntoZone && !bodyConfirms && live.low < fvg.zoneLow;
  } else {
    wickedIntoZone = live.low <= fvg.zoneHigh;
    bodyConfirms = live.close > fvg.zoneHigh;
    wickOnly = wickedIntoZone && !bodyConfirms && live.high > fvg.zoneHigh;
  }

  if (!wickedIntoZone) return null;

  return {
    direction: fvg.direction,
    zoneLow: fvg.zoneLow,
    zoneHigh: fvg.zoneHigh,
    liveClose: live.close,
    liveDatetime: live.datetime,
    bodyConfirms,
    wickOnly,
  };
}

module.exports = { findFvgs, isMitigated, getActiveFvg, evaluateLiveCandle };
