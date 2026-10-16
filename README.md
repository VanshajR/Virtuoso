# Virtuoso Discord Music Bot

Virtuoso is a production-ready, prefix-based Discord music bot focused on high-quality audio playback, minimal transcoding, and smooth multi-guild queue management. It targets free-to-host platforms such as Railway or Fly.io.

## Features
- Prefix-based command system (`!` by default) with per-guild overrides persisted in `data/prefixes.json`.
- High-quality playback using `@discordjs/voice`, `play-dl`, and `yt-dlp-exec`, preferring native Opus/WebM streams.
- Multi-source playback with SoundCloud-first search, clip-aware heuristics, YouTube fallback (toggleable), and direct URL support.
- Interactive `!search` command showing top 5 SoundCloud + 5 YouTube hits with queue buttons.
- Advanced controls: instant seek/forward/rewind, previous-track recall, vote-to-skip with commander bypass, loop/shuffle/remove, autoplay-ready queue.
- Role-aware configuration via `!settings` (commander role, stop restrictions, vote ratio, SoundCloud preference).
- Automatic join-on-play, connection rebinding, stream prefetching for faster track starts, and idle leave timer.
- Verbose, embedded responses for every command plus a help command that lists usage examples.
- Lightweight Express health server for Railway/Fly keep-alive monitoring (`/` and `/health`).
- Configurable logging, graceful shutdown, and defensive error handling + retries for yt-dlp operations.

## Stack
- Node.js 20+
- `discord.js` v14
- `@discordjs/voice`
- `play-dl`, `yt-dlp-exec`, `ffmpeg-static`, `prism-media`
- `dotenv` for environment management
- Optional: `pm2` locally, Railway hosting target, Fly.io alternative

## Security & Legal Warning
Streaming or downloading audio from YouTube may violate YouTube's Terms of Service. Virtuoso includes a `YTDLP_DISABLE`/`youtubeEnabled` switch to disable YouTube playback entirely. When YouTube playback is enabled, the bot logs a warning each time it uses a YouTube source. You are solely responsible for complying with platform policies and content licensing.

## Project Structure
```
virtuoso/
├─ src/
│  ├─ index.js              # Discord entry + Express health server
│  ├─ config.js             # Loads env/config defaults
│  ├─ logger.js             # Simple leveled logger
│  ├─ player/
│  │  ├─ PlayerManager.js   # Core audio/queue orchestrator
│  │  ├─ Track.js           # Track abstraction + stream creation
│  │  └─ queue.js           # Guild queue data structure
│  ├─ commands/             # Prefix commands (play/search/queue/settings/etc.)
│  ├─ handlers/             # Command loader & dispatcher
│  ├─ services/
│  │  └─ queueTrack.js      # Shared logic for queueing + embeds
│  └─ utils/
│     ├─ mediaResolver.js   # Multi-source search + metadata helpers
│     ├─ yt.js              # play-dl + yt-dlp helpers
│     ├─ ffmpegHelpers.js   # Safe ffmpeg spawn utilities
│     ├─ guildSettings.js   # Per-guild playback preferences
│     └─ guildUtils.js      # Prefix persistence helpers
├─ data/prefixes.json       # Stored guild prefixes
├─ .env.example             # Env var template
├─ config.json              # Default config fallback
├─ package.json             # Scripts + dependencies
├─ Procfile                 # Railway process declaration
├─ railway.toml             # Railway deploy configuration
├─ Dockerfile               # Containerized deploy option
└─ README.md                # This file
```

## Setup
1. **Clone & Install**
   ```bash
   git clone <your-fork-url>
   cd virtuoso
   npm install
   ```
   > `yt-dlp-exec@1.0.2` is vendored under `vendor/yt-dlp-exec` and referenced via `file:` in `package.json` to avoid the broken upstream versions that require Python during install. Keep that folder checked into source control so `npm install` works everywhere (Railway, Fly, local dev).
2. **Create `.env`** (copy `.env.example`). Common keys:
   - `DISCORD_TOKEN`: Bot token
   - `PREFIX`: Default text prefix (e.g., `!`)
   - `LEAVE_TIMEOUT`: Seconds before auto-leave when idle
   - `PORT`: Health server port (Railway injects one automatically)
   - `PREFER_OPUS`: `true` to prefer Opus/WebM streams
   - `YTDLP_DISABLE`: `true` to block YouTube playback entirely
   - `SOUNDCLOUD_CLIENT_ID`: Optional SoundCloud app ID for higher-rate API access
   - `PREFER_SOUNDCLOUD`: Default search order (true prioritizes SoundCloud)
   - `SEARCH_RESULTS`, `SEARCH_TIMEOUT_MS`: Interactive search sizing + TTL
   - `VOTE_SKIP_RATIO`: Default vote-to-skip threshold (0.1–1)
   - `STOP_RESTRICTED`: Require commander/single-user for `!stop`
   - `LOG_LEVEL`: `error`, `warn`, `info`, or `debug`
3. **Configure Discord Application**
   - Create a bot at <https://discord.com/developers/applications>
   - Enable **Message Content Intent** and **Server Members Intent**
   - Invite with `bot` + `applications.commands` scopes and permissions `Connect`, `Speak`, `Use Voice Activity`, `Send Messages`.

## Local Development
```bash
npm run dev  # nodemon with auto-reload
# or
npm start    # plain node src/index.js
```
- Run `node src/index.js` and verify "Virtuoso logged in" in console.
- Use `!play <song>` inside your server. Bot will join automatically.
- Idle timeout defaults to 120 seconds; adjust via env or `config.json`.

## Commands
| Command | Description |
| --- | --- |
| `!play [--yt] <url|query>` | Queue a track with SoundCloud-first search (`--yt` forces YouTube) |
| `!search <keywords>` | Show top 5 SoundCloud + 5 YouTube results with queue buttons |
| `!pause` / `!resume` | Control playback state |
| `!skip` | Vote-to-skip (or instant skip for commanders); alias `!next` |
| `!stop` | Clear queue + disconnect (commander role or solo channel by default) |
| `!previous` | Replay the last finished track |
| `!forward [seconds]` / `!rewind [seconds]` | Jump ahead/back (default 10s) |
| `!seek <mm:ss>` | Jump to any timestamp in the current track |
| `!queue [page]` | View queued tracks (10 per page) |
| `!np` | Show now playing + progress |
| `!join` / `!leave` | Manage voice connection manually |
| `!volume <0-200>` | Adjust inline volume |
| `!loop [off|track|queue]` | Cycle loop modes |
| `!remove <#>` | Remove a queued track |
| `!shuffle` | Shuffle queue |
| `!settings [view|set|reset]` | Commander-only per-guild configuration (SoundCloud, votes, stop rules, etc.) |
| `!prefix [new|reset]` | Update or reset the guild-specific prefix |
| `!help` | List commands |

## Deployment — Railway (Free Tier)
1. **Push to GitHub** and connect repository to a Railway project.
2. **Configure variables** under Settings → Variables:
   - `DISCORD_TOKEN`, `PREFIX`, `LEAVE_TIMEOUT`, `PREFER_OPUS`, `YTDLP_DISABLE`, `LOG_LEVEL`.
3. **Deploy**
   - Railway detects `package.json` and runs install.
   - `postinstall` executes `yt-dlp-exec` to ensure the binary is present (no manual curl needed).
   - The `Procfile` (`web: npm start`) + Express health server satisfy Railway’s web process requirement.
4. **Ports**
   - Railway injects `$PORT`. Virtuoso reads `process.env.PORT` so no extra config needed.
5. **Monitoring**
   - Check Deployments tab logs. Enable Redeploy on push for CD.

### Post-install Notes
- Railway build environments sometimes block binary downloads. Since `yt-dlp-exec` bundles multi-platform binaries, no extra action is required beyond letting `postinstall` finish.
- If `play-dl` prompts for YouTube cookies or returns 403, set `PLAYDL_AUTH` env vars per play-dl docs.

## Deployment — Fly.io Alternative
1. Install the Fly CLI and run `fly launch --copy-config --no-deploy` inside the repo.
2. Point Fly at the provided `Dockerfile` (Node 20 Alpine). No additional code changes needed.
3. Set secrets: `fly secrets set DISCORD_TOKEN=... PREFIX=! ...`.
4. Deploy via `fly deploy`. Fly will expose port `8080` by default; set `PORT=8080` secret so Express binds correctly, or configure `[http_service]` to map to `PORT`.

## Troubleshooting
- **Bot won’t join voice**: ensure it has `Connect/Speak` perms and that you’re in a non-stage channel.
- **yt-dlp errors / 403**: often due to rate limits. Retry after a few minutes or disable YouTube playback with `YTDLP_DISABLE=true`.
- **Audio stutters**: Reduce `volume`, disable `loop queue`, or set `PREFER_OPUS=false` to force ffmpeg re-encoding at lower bitrate for stability.
- **Memory usage on free tiers**: Keep queues short, avoid running multiple simultaneous guilds, and prefer Opus to avoid ffmpeg overhead.
- **DEBUG logging**: set `LOG_LEVEL=debug` to print ffmpeg diagnostics and yt-dlp retries.

## Testing Plan
1. **Guild Smoke Test**: Invite the bot to a staging server, run `!join`, `!play <song>`, `!skip`, `!stop`, ensuring voice connect/disconnect works.
2. **Queue Management**: Queue >10 tracks, verify `!queue`, `!remove 3`, `!shuffle`, and loop modes operate correctly.
3. **Error Simulation**: Temporarily disable internet/yt-dlp to verify graceful error replies and logging.
4. **Prefix Overrides**: Manually edit `data/prefixes.json` or implement a command to set prefixes, then restart to confirm persistence.
5. **Deployment Verification**: On Railway/Fly, confirm `/health` returns 200 and console logs show the bot logged in.

## Troubleshooting Checklist Before Support
- `node src/index.js` runs without throwing.
- Bot online in Discord and responds to `!help`.
- `!play <query>` adds to queue and audio plays.
- Railway logs show health server listening on assigned port.
- Express `/health` endpoint responds `ok`.

Happy listening!
