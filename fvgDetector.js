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
 * Only the MOST RECENT FVG is tracked per symbol/timeframe, and only
 * while it's still "fresh": the rebalance must happen on the candle
 * immediately after formation ("D") or the one after that ("E") — i.e.
 * the FVG formed by candles A, B, C is only watched while the currently
 * forming candle is D or E. If neither D nor E trades back into the
 * zone, the FVG expires and is ignored from then on, even if a later
 * candle eventually reaches it.
 */

/** Scan closed candles for 3-candle imbalance patterns. */
function findFvgs(candles) {
  const fvgs = [];
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

/** True if any CLOSED candle after formation has traded INTO the zone
 * and then closed its body fully through it in the direction of the gap
 * (i.e. it tapped the zone and rejected out the far side — the gap has
 * genuinely been used up). A candle that closes beyond the zone WITHOUT
 * ever having entered it doesn't count — that's just price continuing
 * on its own, not a rebalance event. */
function isMitigated(fvg, candles) {
  const closed = candles.slice(0, -1);
  const start = fvg.formedIndex + 1;

  for (let i = start; i < closed.length; i++) {
    const candle = closed[i];
    if (fvg.direction === "bearish" && candle.high >= fvg.zoneLow && candle.close < fvg.zoneLow) {
      return true;
    }
    if (fvg.direction === "bullish" && candle.low <= fvg.zoneHigh && candle.close > fvg.zoneHigh) {
      return true;
    }
  }
  return false;
}

/**
 * The most recent FVG, but ONLY if the currently forming (live) candle is
 * candle D (1 candle after formation) or candle E (2 candles after).
 * Returns null once the window has passed (candle F or later) or if the
 * gap has already been mitigated.
 */
function getActiveFvg(candles) {
  const fvgs = findFvgs(candles);
  if (fvgs.length === 0) return null;

  const latest = fvgs[fvgs.length - 1];
  const liveIndex = candles.length - 1;
  const candlesSinceFormation = liveIndex - latest.formedIndex; // 1 = D is live, 2 = E is live

  if (candlesSinceFormation < 1 || candlesSinceFormation > 2) return null;
  if (isMitigated(latest, candles)) return null;

  return latest;
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