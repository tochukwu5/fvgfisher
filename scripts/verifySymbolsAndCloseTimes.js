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

async function run() {
  console.log("Verifying symbols and printing recent candle timestamps (America/New_York)...\n");

  for (const [pairKey, symbol] of Object.entries(config.PAIRS)) {
    process.stdout.write(`${pairKey.padEnd(8)} (${symbol.padEnd(9)}) -> `);
    try {
      const daily = await dataClient.getCandles(symbol, "1day", 3);
      const fourH = await dataClient.getCandles(symbol, "4h", 3);

      const lastDaily = daily[daily.length - 1];
      const lastFourH = fourH[fourH.length - 1];

      console.log(
        `OK  | last daily candle: ${lastDaily.datetime}  | last 4h candle: ${lastFourH.datetime}`
      );
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
    }
    // small delay to stay well under free-tier rate limits while verifying
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(
    "\nCompare the daily candle timestamps above against DAILY_CLOSE_HOUR_EST in config.js, " +
      "and the 4h timestamps against FOUR_H_CLOSE_HOURS_EST. Adjust config.js if any instrument " +
      "doesn't match (Gold/indices occasionally differ from standard forex hours)."
  );
}

run();
