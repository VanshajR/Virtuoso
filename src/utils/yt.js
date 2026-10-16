const { Readable } = require('stream');
const ytdlp = require('yt-dlp-exec');
const playdl = require('play-dl');

const ARTIST_HINTS = Object.freeze([
  'vevo',
  'topic',
  'official',
  'records',
  'music',
  'オフィシャル',
  ' - topic',
]);

const MUSIC_POSITIVE_KEYWORDS = ['official', 'mv', 'audio', 'music video', 'original', 'ado'];
const MUSIC_NEGATIVE_KEYWORDS = ['shorts', '#shorts', 'short', 'reaction', 'explained', 'challenge', 'meme', 'story', 'episode', 'live', 'cover', 'nightcore', 'sped up', '8d', 'bass boosted', 'dance', 'remix', 'fanmade'];
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'feat', 'ft', 'with', 'official', 'lyrics', 'music', 'video', 'mv', 'song']);

const YT_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i;

async function runWithRetry(fn, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
    }
  }
  throw lastError;
}

function isYouTubeUrl(url) {
  return YT_REGEX.test(url);
}

function normalizeTokens(text = '') {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((token) => token && token.length > 1 && !STOPWORDS.has(token));
}

function computeMatchScore(tokens, text) {
  if (!tokens.length || !text) return 0;
  const haystack = text.toLowerCase();
  const matches = tokens.filter((token) => haystack.includes(token));
  return matches.length / tokens.length;
}

function hasKeyword(text, keywords) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function scoreResult(result, tokens = []) {
  const views = Number(result.views ?? result.view_count ?? result.play_count ?? 0);
  const title = result.title || '';
  const channelName = result.channel?.name
    || (typeof result.channel === 'string' ? result.channel : '')
    || result.uploader
    || result.author
    || '';
  const duration = Number(result.durationInSec ?? result.duration ?? result.lengthSeconds ?? 0) || 0;

  let score = Math.log10(Math.max(views, 1)) * 250;

  const titleMatch = computeMatchScore(tokens, title);
  const channelMatch = computeMatchScore(tokens, channelName);
  score += (titleMatch * 500) + (channelMatch * 150);

  if (titleMatch < 0.35) {
    score -= 200;
  }

  if (duration >= 90 && duration <= 420) {
    score += 300;
  } else if (duration === 0 || duration > 900) {
    score -= 350;
  } else if (duration < 60) {
    score -= 400;
  }

  const channelLower = channelName.toLowerCase();
  const hasArtistHint = ARTIST_HINTS.some((hint) => channelLower.includes(hint));
  if (hasArtistHint) {
    score += 200;
  }

  if (hasKeyword(title, MUSIC_POSITIVE_KEYWORDS)) {
    score += 120;
  }

  if (hasKeyword(title, MUSIC_NEGATIVE_KEYWORDS)) {
    score -= 220;
  }

  if (title.toLowerCase().includes('lyrics')) {
    score -= 80;
  }

  return score;
}

function mapPlayDlResult(item, tokens) {
  const payload = {
    title: item.title,
    url: item.url,
    duration: item.durationInSec,
    thumbnail: item.thumbnails?.[0]?.url,
    channel: item.channel?.name,
    raw: item,
  };
  payload._score = scoreResult(payload, tokens);
  return payload;
}

function mapYtdlpResult(entry, tokens) {
  const payload = {
    title: entry.title,
    url: entry.webpage_url || entry.url,
    duration: entry.duration,
    thumbnail: entry.thumbnail,
    channel: entry.uploader || entry.channel,
    raw: entry,
  };
  payload._score = scoreResult(payload, tokens);
  return payload;
}

async function searchManyWithPlaydl(query, limit, tokens) {
  try {
    const results = await playdl.search(query, { limit, source: { youtube: 'video' } });
    if (!results?.length) return [];
    return results.map((item) => mapPlayDlResult(item, tokens));
  } catch (error) {
    return [];
  }
}

async function searchManyWithYtdlp(query, limit, tokens) {
  try {
    const json = await ytdlp(`ytsearch${limit}:${query}`, {
      dumpSingleJson: true,
      skipDownload: true,
      simulate: true,
      noWarnings: true,
      formatSort: '+br',
    });
    const payload = typeof json === 'string' ? JSON.parse(json) : json;
    const entries = payload?.entries || [];
    return entries.map((entry) => mapYtdlpResult(entry, tokens));
  } catch (error) {
    return [];
  }
}

async function searchMany(query, limit = 8) {
  const tokens = normalizeTokens(query);
  let results = await searchManyWithPlaydl(query, limit, tokens);
  if (!results.length) {
    results = await searchManyWithYtdlp(query, limit, tokens);
  }
  return results.sort((a, b) => b._score - a._score);
}

async function search(query) {
  const sorted = await searchMany(query, 8);
  if (!sorted.length) return null;
  const [best] = sorted;
  const { _score, ...rest } = best;
  return rest;
}

async function fetchJson(url, preferOpus) {
  const args = {
    dumpSingleJson: true,
    noWarnings: true,
    format: preferOpus ? 'bestaudio[acodec=opus]/bestaudio/best' : 'bestaudio/best',
    preferFreeFormats: true,
    addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0'],
  };
  const result = await runWithRetry(() => ytdlp(url, args));
  if (typeof result === 'string') {
    return JSON.parse(result);
  }
  return result;
}

async function fetchStreamDirect(url, headers = {}) {
  const fetchImpl = global.fetch || (await import('node-fetch')).default;
  const response = await fetchImpl(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch audio stream (${response.status})`);
  }
  const contentType = response.headers?.get?.('content-type') || '';
  let stream = response.body;

  if (stream && typeof stream.pipe !== 'function') {
    // Node fetch implementations (undici) return a web ReadableStream; convert it.
    stream = Readable.fromWeb(stream);
  }

  return { stream, contentType };
}

async function getStream(url, preferOpus = true) {
  if (!isYouTubeUrl(url)) {
    const { stream, contentType } = await fetchStreamDirect(url);
    const isOpus = contentType.includes('opus');
    return { stream, isOpus, metadata: { url, contentType } };
  }

  const info = await fetchJson(url, preferOpus);
  const formats = info.formats || [];
  const preferred = formats.find((fmt) => fmt.acodec?.includes('opus')) || formats.find((fmt) => fmt.format_id === info.format_id);
  const selected = preferred || info;
  const directUrl = selected.url || info.url;
  if (!directUrl) throw new Error('yt-dlp did not return a playable URL.');
  const headers = info.http_headers || {};
  const { stream, contentType } = await fetchStreamDirect(directUrl, headers);
  const isOpus = selected.acodec?.includes('opus') || selected.ext === 'webm';
  return { stream, isOpus, metadata: { ...info, contentType } };
}

module.exports = {
  search,
  searchMany,
  getStream,
  isYouTubeUrl,
};
