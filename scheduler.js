/**
 * Computes, for the current moment (in America/New_York time), which
 * timeframe/offset trigger windows are active right now. This is the
 * "clock" the bot runs on — it never asks Twelve Data how much time is
 * left on a candle; close times are derived from the fixed schedule in
 * config.js and simple date arithmetic.
 */

const { DateTime } = require("luxon");
const config = require("./config");

const NY_ZONE = "America/New_York";

function nowInNewYork() {
  return DateTime.now().setZone(NY_ZONE);
}

/** Next 4H close boundary strictly after `now` (or equal, if exactly on it). */
function next4hClose(now) {
  const hours = config.FOUR_H_CLOSE_HOURS_EST;
  const todayCandidates = hours.map((h) =>
    now.set({ hour: h, minute: 0, second: 0, millisecond: 0 })
  );
  const upcoming = todayCandidates.find((dt) => dt >= now);
  if (upcoming) return upcoming;
  // wrap to tomorrow's first boundary
  return now
    .plus({ days: 1 })
    .set({ hour: hours[0], minute: 0, second: 0, millisecond: 0 });
}

/** Next daily close boundary strictly after `now` (or equal). */
function nextDailyClose(now) {
  let close = now.set({
    hour: config.DAILY_CLOSE_HOUR_EST,
    minute: config.DAILY_CLOSE_MINUTE_EST,
    second: 0,
    millisecond: 0,
  });
  if (close < now) close = close.plus({ days: 1 });
  return close;
}

/** Next weekly close boundary (Friday, by default) strictly after `now`. */
function nextWeeklyClose(now) {
  let close = now.set({
    hour: config.WEEKLY_CLOSE_HOUR_EST,
    minute: config.WEEKLY_CLOSE_MINUTE_EST,
    second: 0,
    millisecond: 0,
  });
  // Luxon weekday: Monday=1 ... Sunday=7
  let daysUntilTarget = (config.WEEKLY_CLOSE_WEEKDAY - now.weekday + 7) % 7;
  close = close.plus({ days: daysUntilTarget });
  if (close < now) close = close.plus({ weeks: 1 });
  return close;
}

const CLOSE_FN = {
  "4h": next4hClose,
  daily: nextDailyClose,
  weekly: nextWeeklyClose,
};

/**
 * Returns a list of active triggers for "right now":
 *   [{ timeframeKey, offsetMin, closeDT }, ...]
 * A trigger is active when `now` falls within TRIGGER_TOLERANCE_MIN
 * minutes of (closeTime - offsetMin).
 */
function getActiveTriggers(now = nowInNewYork()) {
  const triggers = [];

  for (const [timeframeKey, tfConfig] of Object.entries(config.TIMEFRAMES)) {
    const closeDT = CLOSE_FN[timeframeKey](now);

    for (const offsetMin of tfConfig.alertOffsetsMin) {
      const triggerDT = closeDT.minus({ minutes: offsetMin });
      const diffMin = Math.abs(now.diff(triggerDT, "minutes").minutes);

      if (diffMin <= config.TRIGGER_TOLERANCE_MIN) {
        triggers.push({ timeframeKey, offsetMin, closeDT });
      }
    }
  }

  return triggers;
}

module.exports = {
  nowInNewYork,
  next4hClose,
  nextDailyClose,
  nextWeeklyClose,
  getActiveTriggers,
};
