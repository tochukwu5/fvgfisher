# FVG Rebalance Alert Bot

Monitors 14 pairs across the 4H, Daily, and Weekly timeframes for a Fair
Value Gap rebalance, and alerts to a Telegram group **before** the candle
closes, so you can pull up the chart and trade it manually.

- 4H → alert 15 min and 5 min before close
- Daily → alert 30 min before close
- Weekly → alert 4 hours before close

Alert fires only once price has traded back into the most recent
unmitigated FVG, and tells you whether the live candle's **body** is
currently confirming beyond the zone (strong) or only wicking into it
(weaker, still forming).

---

## What you need before you start

| Item | Where to get it | Cost |
|---|---|---|
| Twelve Data API key | twelvedata.com | Free plan is enough for this schedule |
| Telegram bot | @BotFather in Telegram | Free |
| Telegram group | Telegram app | Free |
| Railway account | railway.app | You already have Hobby plan |
| This code | provided below | — |

---

## Step 1 — Get your Twelve Data API key

1. Go to https://twelvedata.com and click **Sign Up**, create a free account.
2. Once logged in, go to your **Dashboard** — your API key is shown at the top.
3. Copy it somewhere safe. You'll paste it into Railway in Step 5.

No credit card, no paid plan needed for this bot's call volume.

---

## Step 2 — Create your Telegram bot

1. Open Telegram, search for **@BotFather**, start a chat.
2. Send `/newbot`.
3. Give it a name (e.g. `FVG Alert Bot`) and a username ending in `bot`
   (e.g. `fvg_rebalance_alert_bot`).
4. BotFather replies with a **token** — a long string like
   `123456789:ABCdefGhIJKlmNoPQRstuVWXyz`. Copy it.

---

## Step 3 — Create the Telegram group and get its chat ID

1. In Telegram, create a **new group** (not a channel).
2. Add your bot to the group as a member. Make it an **admin** of the
   group (Group Settings → Administrators → Add Admin → select your bot)
   — this ensures it can always post.
3. Send any message in the group (e.g. "hello").
4. In your browser, visit:
   `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   (replace `<YOUR_BOT_TOKEN>` with your real token).
5. In the JSON response, find `"chat":{"id":-1001234567890,...}` — that
   negative number is your **group chat ID**. Copy it exactly, including
   the minus sign.

---

## Step 4 — Get the code onto GitHub

Railway deploys most easily from a GitHub repo.

1. Download the project files (provided alongside this guide).
2. Go to https://github.com/new, create a new **private** repository
   (e.g. `fvg-alert-bot`).
3. On your machine:
   ```bash
   cd fvg-bot-js
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/fvg-alert-bot.git
   git push -u origin main
   ```
   (`.env` is already excluded via `.gitignore` — never commit your real
   keys.)

---

## Step 5 — Deploy on Railway

1. Go to https://railway.app and open your account (Hobby plan).
2. Click **New Project → Deploy from GitHub repo**, select the
   `fvg-alert-bot` repo you just pushed.
3. Railway will detect it's a Node.js app automatically.
4. Go to the project's **Variables** tab and add these three:
   - `TWELVE_DATA_API_KEY` = (from Step 1)
   - `TELEGRAM_BOT_TOKEN` = (from Step 2)
   - `TELEGRAM_CHAT_ID` = (from Step 3, including the minus sign)
5. Go to **Settings → Deploy** and confirm the start command is
   `node index.js` (the included `Procfile` sets this automatically —
   if Railway asks, set it manually as a **Worker**, not a web service,
   since this bot doesn't listen on a port).
6. Click **Deploy**.

---

## Step 6 — Verify it's alive

1. Open the **Deployments → View Logs** tab in Railway.
2. You should see:
   ```
   FVG Rebalance Alert Bot starting...
   Monitoring 14 pairs across 4h / daily / weekly.
   ```
3. Check your Telegram group — you should receive:
   `✅ FVG Rebalance Alert Bot is online and monitoring your pairs.`

If you don't see that message, double-check the three Variables in Step 5
for typos (this is the #1 cause of a silent failure).

---

## Step 7 — Verify the close-time assumptions (do this once)

Daily and weekly close times can vary slightly by instrument. Before you
rely on it for real trading windows, run the verification script once,
locally:

```bash
npm install
cp .env.example .env      # paste in your real TWELVE_DATA_API_KEY
npm run verify
```

This prints the latest daily and 4H candle timestamp for every pair. If
any pair's timestamps don't align with `DAILY_CLOSE_HOUR_EST` /
`FOUR_H_CLOSE_HOURS_EST` in `config.js` (Gold and Nasdaq are the most
likely to differ from standard forex hours), adjust those values in
`config.js`, commit, and push — Railway will redeploy automatically.

---

## Testing locally before you deploy

```bash
npm install
cp .env.example .env      # paste in your real keys
npm run dev                # starts the bot, auto-restarts on file changes
```

`npm run dev` runs the exact same bot as production (`index.js`), just
with auto-restart on save — useful while you're tweaking `config.js`.
On startup it immediately sends "✅ FVG Rebalance Alert Bot is online..."
to your Telegram group. If that message arrives, your keys are correct
and the pipeline works end-to-end.

It will only send a real *trade* alert when the clock happens to be
inside one of the trigger windows (e.g. 15 min before a 4H close) AND
price is currently rebalancing an FVG — so under normal conditions you
could be running it for a while before you see one. To test the actual
alert logic (Twelve Data fetch → FVG detection → Telegram message)
immediately, without waiting for a real trigger window:

```bash
npm run test-alert -- EURUSD 4h
npm run test-alert -- GOLD daily
```

This checks that specific pair/timeframe right now. If price happens to
be sitting inside an active FVG, you'll get a real Telegram message
prefixed `🧪 TEST ALERT`. If not, it'll print that no FVG rebalance is
currently in progress — that's expected most of the time, not a bug.

## How to update pairs or timing later

- Edit `config.js` (`PAIRS`, `TIMEFRAMES`, offsets).
- Commit and push to GitHub — Railway redeploys automatically on every push.

## What the alerts look like

```
🔻 EURUSD — 4H FVG rebalance

Bias: BEARISH continuation
✅ Body CONFIRMED beyond FVG — high-quality rejection

Zone: 1.08650 – 1.08820
Current price: 1.08590
Candle closes: Tue 21 Jul, 16:00 NY (in ~15 min)

Check the chart — this is a heads-up, not a final signal.
```

## Known limitations (worth knowing, not blockers)

- This is a **heads-up scanner**, not a fully automatic strategy — you
  still open the chart and decide, as intended.
- The "body confirms" check is evaluated on the candle's live price at
  alert time. Price can still move before the actual close, so treat it
  as "on track," not guaranteed.
- Free Twelve Data plan has a rate limit — with this schedule you'll use
  roughly ~200 calls/day, well under the 800/day free cap. If you later
  add more pairs or tighter check intervals, you may need to upgrade to
  the Grow plan ($29/mo).
