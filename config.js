/**
 * Central configuration for the FVG Rebalance Alert Bot.
 *
 * Everything you're likely to want to tweak lives here: pairs monitored,
 * Twelve Data symbol mapping, timeframe schedule, and the market-close
 * anchor times used to compute alert windows.
 */

require("dotenv").config();

module.exports = {
  // ---------------------------------------------------------------------
  // Secrets (set these in Railway's Variables tab — never hard-code them)
  // ---------------------------------------------------------------------
  TWELVE_DATA_API_KEY: process.env.TWELVE_DATA_API_KEY || "",
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || "", // group chat id, e.g. -1001234567890

  // ---------------------------------------------------------------------
  // Pairs to monitor -> Twelve Data symbol
  // NOTE: verify "NASDAQ" against your Twelve Data plan before going live.
  // Futures (NQ) usually need a market-data add-on; NDX (Nasdaq 100 cash
  // index) is the safe default and is what this config uses.
  // ---------------------------------------------------------------------
  PAIRS: {
    GOLD: "XAU/USD",
    NASDAQ: "NDX",
   
  },

  // ---------------------------------------------------------------------
  // Timeframe schedule
  //   interval          -> Twelve Data interval string
  //   alertOffsetsMin    -> minutes before candle close to check + alert
  // ---------------------------------------------------------------------
  TIMEFRAMES: {
    "4h": { interval: "4h", alertOffsetsMin: [15, 5] },
    daily: { interval: "1day", alertOffsetsMin: [30] },
    weekly: { interval: "1week", alertOffsetsMin: [240] }, // 4 hours
  },

  // ---------------------------------------------------------------------
  // Close-time anchors, all in America/New_York (EST/EDT) — this is the
  // timezone Twelve Data uses internally for 1day/1week candles regardless
  // of any timezone parameter passed in the request.
  //
  // Defaults follow the standard forex/metals convention (daily rollover
  // and weekly close at 17:00 New York time). VERIFY these once during
  // setup with `npm run verify` — index/futures instruments can differ.
  // ---------------------------------------------------------------------
  DAILY_CLOSE_HOUR_EST: 17,
  DAILY_CLOSE_MINUTE_EST: 0,

  WEEKLY_CLOSE_WEEKDAY: 5, // Luxon weekday: Mon=1 ... Fri=5
  WEEKLY_CLOSE_HOUR_EST: 17,
  WEEKLY_CLOSE_MINUTE_EST: 0,

  // 4H candles close on these New York hours — confirmed via `npm run
  // verify` against real Twelve Data timestamps, and matching the
  // standard forex broker grid (Oanda/FXCM close at 5am, 9am, 1pm, 5pm,
  // 9pm, 1am New York time). NOT midnight-aligned.
  FOUR_H_CLOSE_HOURS_EST: [1, 5, 9, 13, 17, 21],

  // ---------------------------------------------------------------------
  // Strategy parameters
  // ---------------------------------------------------------------------
  CANDLE_LOOKBACK: 40, // history pulled per check
  TRIGGER_TOLERANCE_MIN: 1, // scheduler tick is 60s, so 1-min tolerance is enough
  SCHEDULER_TICK_SECONDS: 60,
};