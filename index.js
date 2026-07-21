/**
 * Entry point. Runs a continuous loop that wakes up once a minute, checks
 * whether any timeframe/offset trigger window is active, and — if so —
 * pulls fresh candles for every monitored pair and evaluates the FVG
 * rebalance + body-close strategy, alerting to Telegram when relevant.
 */

const config = require("./config");
const dataClient = require("./dataClient");
const fvgDetector = require("./fvgDetector");
const telegramClient = require("./telegramClient");
const { formatAlert } = require("./formatAlert");
const { nowInNewYork, getActiveTriggers } = require("./scheduler");

// In-memory dedupe so we don't alert twice for the same
// pair + timeframe + offset + candle-close combination.
const alreadyAlerted = new Set();

function requiredEnvPresent() {
  const missing = [];
  if (!config.TWELVE_DATA_API_KEY) missing.push("TWELVE_DATA_API_KEY");
  if (!config.TELEGRAM_BOT_TOKEN) missing.push("TELEGRAM_BOT_TOKEN");
  if (!config.TELEGRAM_CHAT_ID) missing.push("TELEGRAM_CHAT_ID");
  return missing;
}

async function checkPairTimeframe(pairKey, symbol, timeframeKey, offsetMin, closeDT) {
  const dedupeKey = `${pairKey}:${timeframeKey}:${offsetMin}:${closeDT.toISO()}`;
  if (alreadyAlerted.has(dedupeKey)) return;

  try {
    const interval = config.TIMEFRAMES[timeframeKey].interval;
    const candles = await dataClient.getCandles(symbol, interval);

    const fvg = fvgDetector.getActiveFvg(candles);
    if (!fvg) return;

    const evalResult = fvgDetector.evaluateLiveCandle(fvg, candles);
    if (!evalResult) return; // price hasn't reached the zone — nothing to report

    const text = formatAlert({ pairKey, timeframeKey, offsetMin, evalResult, closeDT });
    const sent = await telegramClient.sendMessage(text);

    if (sent) {
      alreadyAlerted.add(dedupeKey);
      console.log(`[alert] sent: ${pairKey} ${timeframeKey} (-${offsetMin}m)`);
    }
  } catch (err) {
    console.error(`[check] ${pairKey} ${timeframeKey} failed: ${err.message}`);
  }
}

async function runTick() {
  const now = nowInNewYork();
  const triggers = getActiveTriggers(now);
  if (triggers.length === 0) return;

  for (const trigger of triggers) {
    console.log(
      `[tick] trigger active: ${trigger.timeframeKey} -${trigger.offsetMin}m ` +
        `(closes ${trigger.closeDT.toFormat("ccc HH:mm")} NY)`
    );

    const jobs = Object.entries(config.PAIRS).map(([pairKey, symbol]) =>
      checkPairTimeframe(pairKey, symbol, trigger.timeframeKey, trigger.offsetMin, trigger.closeDT)
    );
    await Promise.allSettled(jobs);
  }

  // Keep the dedupe set from growing forever — anything older than 8 days
  // is safe to forget (nothing in our schedule looks back further than a week).
  if (alreadyAlerted.size > 5000) alreadyAlerted.clear();
}

async function main() {
  const missing = requiredEnvPresent();
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    console.error("Set them in your .env file (local) or Railway Variables tab (deployed).");
    process.exit(1);
  }

  console.log("FVG Rebalance Alert Bot starting...");
  console.log(`Monitoring ${Object.keys(config.PAIRS).length} pairs across 4h / daily / weekly.`);

  await telegramClient.sendMessage(
    "✅ FVG Rebalance Alert Bot is online and monitoring your pairs."
  );

  setInterval(runTick, config.SCHEDULER_TICK_SECONDS * 1000);
  runTick(); // also run one immediately on boot
}

main();
