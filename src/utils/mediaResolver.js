const playdl = require('play-dl');
const yt = require('./yt');

const URL_PATTERN = /^https?:\/\//i;
const SOUNDCLOUD_PATTERN = /(soundcloud\.com|snd\.sc|on\.soundcloud\.com)/i;
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'feat', 'ft', 'with', 'official', 'lyrics', 'music', 'video']);
const CLIP_KEYWORDS = new Set(['clip', 'short', 'snippet', 'preview', 'teaser']);
const MIN_SONG_DURATION = 75; // seconds
const HARD_MIN_DURATION = 45; // seconds
const IDEAL_DURATION = 240; // seconds
const SOUND_CLOUD_DEFAULT_LIMIT = 5;

let lastSoundCloudError = null;
let soundCloudAvailable = true;

function parseSoundCloudError(error) {
  if (!error) return null;
  const message = error.message || 'Unknown SoundCloud error';
  const code = error.statusCode || error.status || error.code
    || (message.includes('401') ? 401 : null);
  return { code, message };
}

function markSoundCloudSuccess() {
  soundCloudAvailable = true;
  lastSoundCloudError = null;
}

function markSoundCloudFailure(error) {
  const parsed = parseSoundCloudError(error) || { message: error?.message || 'Unknown SoundCloud error' };
  lastSoundCloudError = parsed;
  if (parsed.code === 401 || parsed.code === 403) {
    soundCloudAvailable = false;
  }
}

function getSoundCloudStatus() {
  return {
    lastError: lastSoundCloudError,
    available: soundCloudAvailable,
  };
}

function isSoundCloudUrl(value = '') {
  return SOUNDCLOUD_PATTERN.test(value);
}

function normalizeDuration(seconds, fallbackMs) {
  if (typeof seconds === 'number' && Number.isFinite(seconds)) {
    return seconds;
  }
  if (typeof fallbackMs === 'number' && Number.isFinite(fallbackMs)) {
    return Math.round(fallbackMs / 1000);
  }
  return 0;
}

function mapYouTubeResult(result) {
  if (!result) return null;
  const { _score, ...rest } = result;
  return {
    title: rest.title,
    url: rest.url,
    duration: rest.duration,
    thumbnail: rest.thumbnail,
    source: 'youtube',
    artist: rest.channel || null,
    raw: rest,
  };
}

function mapSoundCloudResult(item) {
  if (!item) return null;
  return {
    title: item.name || item.title,
    url: item.url,
    duration: normalizeDuration(item.durationInSec, item.durationInMs),
    thumbnail: item.thumbnail || item.thumbnails?.[0]?.url || null,
    source: 'soundcloud',
    artist: item.artist?.name || item.user?.name || item.channel?.name || null,
    raw: item,
  };
}

async function fetchYouTubeByUrl(url) {
  const info = await playdl.video_basic_info(url);
  const details = info.video_details || {};
  return {
    title: details.title,
    url: details.url,
    duration: details.durationInSec,
    thumbnail: details.thumbnails?.[0]?.url,
    source: 'youtube',
    artist: details.channel?.name || details.uploader?.name || null,
    raw: info,
  };
}

async function fetchSoundCloudByUrl(url, logger = null) {
  try {
    const info = await playdl.soundcloud(url);
    if (!info) return null;
    markSoundCloudSuccess();
    return mapSoundCloudResult(info);
  } catch (error) {
    markSoundCloudFailure(error);
    logger?.warn?.(`[SoundCloud] Track fetch failed: ${error.message}`);
    return null;
  }
}

async function getSoundCloudCandidates(query, limit = 5, logger = null) {
  try {
    const results = await playdl.search(query, { limit, source: { soundcloud: 'tracks' } });
    markSoundCloudSuccess();
    return results.map(mapSoundCloudResult).filter(Boolean);
  } catch (error) {
    markSoundCloudFailure(error);
    logger?.warn?.(`[SoundCloud] search failed for "${query}": ${error.message}`);
    return [];
  }
}

async function searchSoundCloud(query, limit = 5) {
  return getSoundCloudCandidates(query, limit);
}

function tokenize(query = '') {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token && !STOPWORDS.has(token));
}

function rankSoundCloudCandidates(query, results = []) {
  if (!results.length) return [];
  const tokens = tokenize(query);
  const clipRequested = tokens.some((token) => CLIP_KEYWORDS.has(token));

  return results
    .map((track, index) => {
      const haystack = `${track.title || ''} ${track.artist || ''}`.toLowerCase();
      const matchCount = tokens.filter((token) => haystack.includes(token)).length;
      const tokenScore = tokens.length ? (matchCount / tokens.length) : 0.5;
      let durationScore = 0;
      if (track.duration && track.duration > 0) {
        durationScore = Math.min(1, track.duration / IDEAL_DURATION);
        if (!clipRequested) {
          if (track.duration < HARD_MIN_DURATION) {
            durationScore *= 0.05;
          } else if (track.duration < MIN_SONG_DURATION) {
            durationScore *= 0.4;
          }
        }
      }
      const orderBoost = Math.max(0.5, 1 - (index * 0.08));
      const score = (tokenScore * 0.65 + durationScore * 0.35) * orderBoost;
      return {
        track,
        score,
        tokenScore,
        durationScore,
        clipRequested,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function shouldAcceptSoundCloudCandidate(entry, { allowShortFallback = false } = {}) {
  if (!entry) return false;
  const duration = entry.track?.duration || 0;
  if (entry.clipRequested) {
    return duration >= 15;
  }
  if (duration >= MIN_SONG_DURATION) {
    return entry.score >= 0.25 || entry.tokenScore >= 0.4;
  }
  if (allowShortFallback && duration >= HARD_MIN_DURATION) {
    return true;
  }
  return false;
}

async function resolveTrack(
  query,
  {
    preferSoundCloud = true,
    forceYouTube = false,
    allowYouTube = true,
    logger = null,
  } = {},
) {
  if (!query) return null;
  const trimmed = query.trim();
  const isUrl = URL_PATTERN.test(trimmed);

  if (isUrl) {
    if (yt.isYouTubeUrl(trimmed)) {
      return fetchYouTubeByUrl(trimmed);
    }
    if (isSoundCloudUrl(trimmed)) {
      const sc = await fetchSoundCloudByUrl(trimmed, logger);
      if (sc) return sc;
      return null;
    }
    return {
      title: trimmed,
      url: trimmed,
      duration: 0,
      source: 'url',
      raw: { url: trimmed },
    };
  }

  let rankedSoundCloud = [];
  const { available } = getSoundCloudStatus();
  const allowSoundCloudSearch = !forceYouTube && preferSoundCloud && available;

  if (allowSoundCloudSearch) {
    const soundcloudResults = await getSoundCloudCandidates(trimmed, SOUND_CLOUD_DEFAULT_LIMIT, logger);
    rankedSoundCloud = rankSoundCloudCandidates(trimmed, soundcloudResults);
    const accepted = rankedSoundCloud.find((entry) => shouldAcceptSoundCloudCandidate(entry));
    if (accepted) {
      return accepted.track;
    }
  }

  let youtubeHit = null;
  if (allowYouTube) {
    try {
      youtubeHit = await yt.search(trimmed);
    } catch (error) {
      logger?.warn?.(`YouTube search failed for "${trimmed}": ${error.message}`);
      youtubeHit = null;
    }
  }
  if (youtubeHit) {
    return mapYouTubeResult({ ...youtubeHit, _score: 0 });
  }

  if (!forceYouTube) {
    if (!preferSoundCloud) {
      const fallbackRanked = rankSoundCloudCandidates(
        trimmed,
        await getSoundCloudCandidates(trimmed, SOUND_CLOUD_DEFAULT_LIMIT, logger),
      );
      const acceptedFallback = fallbackRanked.find((entry) => shouldAcceptSoundCloudCandidate(entry, { allowShortFallback: true }));
      if (acceptedFallback) return acceptedFallback.track;
      if (fallbackRanked[0]) return fallbackRanked[0].track;
    } else if (rankedSoundCloud.length) {
      const relaxed = rankedSoundCloud.find((entry) => shouldAcceptSoundCloudCandidate(entry, { allowShortFallback: true }));
      if (relaxed) return relaxed.track;
      return rankedSoundCloud[0].track;
    }
  }

  return null;
}

async function dualSearch(query, { perSource = 5 } = {}) {
  if (!query) return { soundcloud: [], youtube: [] };
  const [soundcloud, youtubeRaw] = await Promise.all([
    searchSoundCloud(query, perSource),
    yt.searchMany(query, perSource).catch(() => []),
  ]);
  const youtube = youtubeRaw.map(mapYouTubeResult).filter(Boolean);
  return { soundcloud, youtube };
}

module.exports = {
  resolveTrack,
  dualSearch,
  searchSoundCloud,
  fetchSoundCloudByUrl,
  fetchYouTubeByUrl,
  isSoundCloudUrl,
  getSoundCloudStatus,
  markSoundCloudFailure,
  markSoundCloudSuccess,
};
