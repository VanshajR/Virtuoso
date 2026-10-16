const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const CONFIG_PATH = path.resolve(__dirname, '..', 'config.json');

function loadJsonConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn('[config] Could not read config.json, falling back to defaults.', error.message);
    return {};
  }
}

const fileConfig = loadJsonConfig();

const config = {
  token: process.env.DISCORD_TOKEN || fileConfig.token || '',
  prefix: process.env.PFX || process.env.PREFIX || fileConfig.prefix || '!',
  leaveTimeout: Number(process.env.LEAVE_TIMEOUT || fileConfig.leaveTimeout || 120),
  youtubeEnabled: process.env.YTDLP_DISABLE === 'true' ? false : (fileConfig.youtubeEnabled ?? true),
  ownerId: process.env.OWNER_ID || fileConfig.ownerId || null,
  logLevel: process.env.LOG_LEVEL || fileConfig.logLevel || 'info',
  preferOpus: process.env.PREFER_OPUS ? process.env.PREFER_OPUS === 'true' : (fileConfig.preferOpus ?? true),
  port: Number(process.env.PORT || fileConfig.port || 3000),
  debug: process.env.DEBUG === 'true' || fileConfig.debug || false,
  soundcloudClientId: process.env.SOUNDCLOUD_CLIENT_ID || fileConfig.soundcloudClientId || '',
  preferSoundCloud: process.env.PREFER_SOUNDCLOUD ? process.env.PREFER_SOUNDCLOUD === 'true' : (fileConfig.preferSoundCloud ?? true),
  defaultCommanderRole: process.env.COMMANDER_ROLE || fileConfig.defaultCommanderRole || null,
  searchResults: Number(process.env.SEARCH_RESULTS || fileConfig.searchResults || 5),
  searchTimeoutMs: Number(process.env.SEARCH_TIMEOUT_MS || fileConfig.searchTimeoutMs || 60000),
  voteSkipRatio: Number(process.env.VOTE_SKIP_RATIO || fileConfig.voteSkipRatio || 0.5),
  stopRestricted: process.env.STOP_RESTRICTED ? process.env.STOP_RESTRICTED === 'true' : (fileConfig.stopRestricted ?? true),
  autoplayDefault: process.env.AUTOPLAY_DEFAULT ? process.env.AUTOPLAY_DEFAULT === 'true' : (fileConfig.autoplayDefault ?? false),
};

function validateConfig() {
  if (!config.token) {
    throw new Error('DISCORD_TOKEN is required. Set it in the environment or config.json.');
  }
}

module.exports = {
  config,
  validateConfig,
};
