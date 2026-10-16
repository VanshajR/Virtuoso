<p align="center">
  <img src="docs/banner.png" alt="Virtuoso" width="100%">
</p>

<p align="center">
  A Discord music bot that starts tracks fast, keeps every server's queue separate, and lets the room decide what gets skipped.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white" alt="Node 20+">
  <img src="https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white" alt="discord.js v14">
  <img src="https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker ready">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
</p>

## What it does

- **Plays from SoundCloud first**, with YouTube as a fallback you can switch off, and direct links to either.
- **Starts tracks quickly** by prefetching the next stream and preferring native Opus, so most tracks skip re-encoding.
- **Interactive search**: `!search` shows the top hits from both sources with buttons to queue them.
- **Fair skipping**: vote-to-skip with an adjustable threshold, plus a *Commander* role that can skip outright.
- **Precise control**: seek to a timestamp, jump forward or back, replay the previous track, loop a track or the queue, shuffle, remove.
- **Per-server everything**: separate queues, prefixes and settings for every server it's in.
- **Free-host friendly**: leaves idle channels on its own and serves a `/health` endpoint for uptime pings.

## Commands

| Command | What it does |
| --- | --- |
| `!play <song or link>` (`!p`) | Queue a track; add `--yt` to search YouTube instead |
| `!search <keywords>` | Pick from the top SoundCloud and YouTube results |
| `!pause` · `!resume` | Pause and carry on |
| `!skip` (`!next`) | Vote to skip, or skip outright as a Commander |
| `!previous` (`!back`) | Replay the last track |
| `!seek <mm:ss>` · `!forward [s]` · `!rewind [s]` | Move around the current track |
| `!queue [page]` · `!np` | See what's queued and what's playing |
| `!loop [off\|track\|queue]` · `!shuffle` · `!remove <#>` | Shape the queue |
| `!volume <0-200>` | Set the volume |
| `!join` · `!leave` · `!stop` | Manage the voice connection |
| `!settings` | Per-server playback rules (Commander only) |
| `!prefix [new\|reset]` | Change this server's prefix (needs Manage Server) |
| `!help` | List everything |

## Run it

1. Create an application at the [Discord developer portal](https://discord.com/developers/applications), add a bot, and turn on **Message Content Intent**.
2. Invite it with the `bot` and `applications.commands` scopes and the *Connect*, *Speak* and *Send Messages* permissions.
3. Then:

```bash
git clone https://github.com/VanshajR/Virtuoso.git
cd Virtuoso
npm install
cp .env.example .env      # set DISCORD_TOKEN; everything else has a sensible default
npm start
```

Use `npm run dev` to restart on changes. `.env.example` lists the knobs: prefix, idle timeout, vote ratio, source preference and logging.

## Hosting

Virtuoso is a single Node process with a health endpoint, so it runs on most free tiers:

- **Docker** (Fly.io, Koyeb and others): use the included `Dockerfile` and set `DISCORD_TOKEN` as a secret.
- **Railway**: `railway.toml` and the `Procfile` are already set up; add your variables and deploy.

If the host sleeps idle services, point an uptime pinger at `/health`.

> `yt-dlp-exec` is vendored in `vendor/` because recent upstream releases need Python at install time. It downloads the right yt-dlp binary for your platform during `npm install`.

## A note on YouTube

Streaming from YouTube may break YouTube's Terms of Service. Set `YTDLP_DISABLE=true` to turn YouTube off entirely, and the bot plays from SoundCloud and direct links only. When YouTube is on, the bot logs a warning each time it uses it. Make sure your use complies with each platform's terms.

## License

[MIT](LICENSE)
