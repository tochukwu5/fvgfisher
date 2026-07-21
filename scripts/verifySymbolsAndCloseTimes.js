/**
 * Run once before going live:  npm run verify
 *
 * For every configured pair, pulls the latest daily and 4h candle and
 * prints the raw timestamps Twelve Data returns. Use this to confirm:
 *   1. Every symbol resolves (no typos / unsupported instruments).
 *   2. The daily/4h close hours in config.js actually match what
 *      Twelve Data reports for each instrument (Gold, indices, and
 *      forex can differ slightly).
 */

const config = require("../config");
const dataClient = require("../dataClient");

// Free Twelve Data plan allows 8 calls/minute. We make 2 calls per pair
// (daily + 4h), so we space every individual call 12 seconds apart to
// stay safely under that limit even if calls bunch up near a minute
// boundary.
const DELAY_BETWEEN_CALLS_MS = 12000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log("Verifying symbols and printing recent candle timestamps (America/New_York)...");
  console.log("(This runs slowly on purpose, to respect the free plan's rate limit — expect ~4 min total.)\n");

  let callCount = 0;

  for (const [pairKey, symbol] of Object.entries(config.PAIRS)) {
    process.stdout.write(`${pairKey.padEnd(8)} (${symbol.padEnd(9)}) -> `);
    try {
      if (callCount > 0) await sleep(DELAY_BETWEEN_CALLS_MS);
      const daily = await dataClient.getCandles(symbol, "1day", 3);
      callCount++;

      await sleep(DELAY_BETWEEN_CALLS_MS);
      const fourH = await dataClient.getCandles(symbol, "4h", 3);
      callCount++;

      const lastDaily = daily[daily.length - 1];
      const lastFourH = fourH[fourH.length - 1];

      console.log(
        `OK  | last daily candle: ${lastDaily.datetime}  | last 4h candle: ${lastFourH.datetime}`
      );
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
    }
  }

  console.log(
    "\nCompare the daily candle timestamps above against DAILY_CLOSE_HOUR_EST in config.js, " +
      "and the 4h timestamps against FOUR_H_CLOSE_HOURS_EST. Adjust config.js if any instrument " +
      "doesn't match (Gold/indices occasionally differ from standard forex hours)."
  );
}

run();