const fs = require('fs');
const path = require('path');

const PREFIX_STORE = path.resolve(__dirname, '..', '..', 'data', 'prefixes.json');
let prefixCache = {};

function ensureStore() {
  try {
    if (!fs.existsSync(PREFIX_STORE)) {
      fs.writeFileSync(PREFIX_STORE, JSON.stringify({}, null, 2), 'utf8');
    }
    const raw = fs.readFileSync(PREFIX_STORE, 'utf8');
    prefixCache = JSON.parse(raw || '{}');
  } catch (error) {
    console.error('[guildUtils] Failed to initialize prefix store:', error);
    prefixCache = {};
  }
}

function persist() {
  try {
    fs.writeFileSync(PREFIX_STORE, JSON.stringify(prefixCache, null, 2), 'utf8');
  } catch (error) {
    console.error('[guildUtils] Failed to persist prefix store:', error);
  }
}

function getPrefix(guildId, fallback) {
  if (!guildId) return fallback;
  if (!prefixCache[guildId]) return fallback;
  return prefixCache[guildId];
}

function setPrefix(guildId, prefix) {
  if (!guildId || !prefix) return;
  prefixCache[guildId] = prefix;
  persist();
}

function clearPrefix(guildId) {
  if (!guildId) return;
  delete prefixCache[guildId];
  persist();
}

ensureStore();

module.exports = {
  getPrefix,
  setPrefix,
  clearPrefix,
};
