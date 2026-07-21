/**
 * Minimal Telegram Bot API client — sends messages to a group chat.
 */

const axios = require("axios");
const config = require("./config");

async function sendMessage(text) {
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) {
    console.error("[telegram] Bot token or chat id is not configured.");
    return false;
  }

  const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: config.TELEGRAM_CHAT_ID,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  };

  try {
    const resp = await axios.post(url, payload, { timeout: 10000 });
    if (resp.status !== 200) {
      console.error(`[telegram] send failed [${resp.status}]: ${JSON.stringify(resp.data)}`);
      return false;
    }
    return true;
  } catch (err) {
    const detail = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error(`[telegram] send exception: ${detail}`);
    return false;
  }
}

module.exports = { sendMessage };
