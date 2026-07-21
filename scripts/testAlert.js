/**
 * Test the full pipeline (Twelve Data -> FVG logic -> Telegram) for ONE
 * pair, right now, without waiting for a real trigger window.
 *
 * Usage:
 *   node scripts/testAlert.js EURUSD 4h
 *   node scripts/testAlert.js GOLD daily
 *
 * If price is currently sitting inside an active FVG on that pair/
 * timeframe, you'll get a real Telegram message. If not, it will just
 * print what it found (no active/rebalancing FVG right now) — that's
 * normal and doesn't mean anything is broken.
 */

const config = require("../config");
const dataClient = require("../dataClient");
const fvgDetector = require("../fvgDetector");
const telegramClient = require("../telegramClient");
const { formatAlert } = require("../formatAlert");
const { next4hClose, nextDailyClose, nextWeeklyClose, nowInNewYork } = require("../scheduler");

const CLOSE_FN = { "4h": next4hClose, daily: nextDailyClose, weekly: nextWeeklyClose };

async function main() {
  const [, , pairKeyArg, timeframeArg] = process.argv;

  if (!pairKeyArg || !timeframeArg) {
    console.log("Usage: node scripts/testAlert.js <PAIR_KEY> <4h|daily|weekly>");
    console.log("Example: node scripts/testAlert.js EURUSD 4h");
    process.exit(1);
  }

  const pairKey = pairKeyArg.toUpperCase();
  const timeframeKey = timeframeArg.toLowerCase();

  const symbol = config.PAIRS[pairKey];
  const tfConfig = config.TIMEFRAMES[timeframeKey];

  if (!symbol) {
    console.error(`Unknown pair key "${pairKey}". Valid keys: ${Object.keys(config.PAIRS).join(", ")}`);
    process.exit(1);
  }
  if (!tfConfig) {
    console.error(`Unknown timeframe "${timeframeKey}". Valid: 4h, daily, weekly`);
    process.exit(1);
  }

  console.log(`Fetching ${symbol} [${tfConfig.interval}] candles...`);
  const candles = await dataClient.getCandles(symbol, tfConfig.interval);

  const fvg = fvgDetector.getActiveFvg(candles);
  if (!fvg) {
    console.log("No active (unmitigated) FVG found on this pair/timeframe right now. Nothing to alert.");
    return;
  }
  console.log("Active FVG:", fvg);

  const evalResult = fvgDetector.evaluateLiveCandle(fvg, candles);
  if (!evalResult) {
    console.log("Price hasn't traded back into the FVG zone yet — no rebalance in progress. Nothing to alert.");
    return;
  }
  console.log("Live candle evaluation:", evalResult);

  const closeDT = CLOSE_FN[timeframeKey](nowInNewYork());
  const text = formatAlert({ pairKey, timeframeKey, offsetMin: 0, evalResult, closeDT });

  console.log("\n--- Message that will be sent ---\n" + text + "\n----------------------------------\n");

  const sent = await telegramClient.sendMessage(`🧪 *TEST ALERT*\n\n${text}`);
  console.log(sent ? "Sent to Telegram successfully." : "Failed to send — check your bot token / chat id.");
}

main().catch((err) => {
  console.error("Test failed:", err.message);
  process.exit(1);
});
