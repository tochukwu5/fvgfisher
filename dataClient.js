/**
 * Thin wrapper around the Twelve Data /time_series endpoint.
 */

const axios = require("axios");
const config = require("./config");

const BASE_URL = "https://api.twelvedata.com/time_series";

class DataClientError extends Error {}

/**
 * Returns an array of candles, OLDEST FIRST:
 *   [{ datetime, open, high, low, close }, ...]
 * The last element is the most recent (and, for the current period,
 * still-forming) candle.
 */
async function getCandles(symbol, interval, outputsize = config.CANDLE_LOOKBACK) {
  const params = {
    symbol,
    interval,
    outputsize,
    apikey: config.TWELVE_DATA_API_KEY,
    timezone: "America/New_York",
    order: "ASC",
  };

  const { data } = await axios.get(BASE_URL, { params, timeout: 15000 });

  if (data && data.status === "error") {
    throw new DataClientError(`${symbol} [${interval}]: ${data.message}`);
  }

  const values = data && data.values;
  if (!values || values.length === 0) {
    throw new DataClientError(`${symbol} [${interval}]: no candle data returned`);
  }

  return values.map((row) => ({
    datetime: row.datetime,
    open: parseFloat(row.open),
    high: parseFloat(row.high),
    low: parseFloat(row.low),
    close: parseFloat(row.close),
  }));
}

module.exports = { getCandles, DataClientError };
