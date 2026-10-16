const fs = require('fs');
const path = require('path');

const SETTINGS_STORE = path.resolve(__dirname, '..', '..', 'data', 'guildSettings.json');
const DEFAULTS = Object.freeze({
  preferSoundCloud: true,
  voteSkipEnabled: false,
  voteSkipRatio: 0.5,
  autoplay: false,
  commanderRole: null,
  stopRestricted: true,
});

let cache = {};

function ensureStore() {
  try {
    if (!fs.existsSync(SETTINGS_STORE)) {
      fs.mkdirSync(path.dirname(SETTINGS_STORE), { recursive: true });
      fs.writeFileSync(SETTINGS_STORE, JSON.stringify({}, null, 2), 'utf8');
    }
    const raw = fs.readFileSync(SETTINGS_STORE, 'utf8') || '{}';
    cache = JSON.parse(raw);
  } catch (error) {
    console.error('[guildSettings] Failed to initialize store:', error);
    cache = {};
  }
}

function persist() {
  try {
    fs.writeFileSync(SETTINGS_STORE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (error) {
    console.error('[guildSettings] Failed to persist store:', error);
  }
}

function getSettings(guildId) {
  if (!guildId) return { ...DEFAULTS };
  if (!cache[guildId]) {
    cache[guildId] = { ...DEFAULTS };
  }
  return { ...DEFAULTS, ...cache[guildId] };
}

function updateSettings(guildId, patch = {}) {
  if (!guildId) return getSettings(guildId);
  const next = { ...getSettings(guildId), ...patch };
  cache[guildId] = next;
  persist();
  return next;
}

function resetSettings(guildId) {
  if (!guildId) return;
  delete cache[guildId];
  persist();
}

ensureStore();

module.exports = {
  DEFAULTS,
  getSettings,
  updateSettings,
  resetSettings,
};
