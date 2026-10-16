const { PassThrough } = require('stream');
const playdl = require('play-dl');
const yt = require('../utils/yt');
const { markSoundCloudFailure } = require('../utils/mediaResolver');
const { transcodeToOpus } = require('../utils/ffmpegHelpers');

class Track {
  constructor({
    title,
    url,
    duration,
    requestedBy,
    source = 'youtube',
    raw = {},
    thumbnail = null,
    artist = null,
  }) {
    this.title = title || 'Unknown title';
    this.url = url;
    this.duration = duration || 0;
    this.requestedBy = requestedBy;
    this.source = source;
    this.raw = raw;
    this.thumbnail = thumbnail || null;
    this.artist = artist || null;

    this.prefetchInfo = null;
    this.prefetchPromise = null;
  }

  async prefetch() {
    if (this.prefetchPromise) return this.prefetchPromise;
    if (this.source !== 'youtube' || !yt.isYouTubeUrl(this.url)) return null;
    this.prefetchPromise = playdl.video_info(this.url)
      .then((info) => {
        this.prefetchInfo = info;
        return info;
      })
      .catch((error) => {
        this.prefetchPromise = null;
        throw error;
      });
    return this.prefetchPromise;
  }

  async createStream(options = {}) {
    const preferOpus = options.preferOpus ?? true;
    const allowYouTube = options.youtubeEnabled !== false;
    const seekSeconds = typeof options.seek === 'number' && options.seek >= 0 ? options.seek : undefined;

    if (this.source === 'youtube' && yt.isYouTubeUrl(this.url) && !allowYouTube) {
      throw new Error('YouTube playback is disabled by configuration.');
    }

    const streamResult = await this.tryPlayDlStream({ seekSeconds, logger: options.logger });
    if (streamResult) {
      return streamResult;
    }

    if (this.source === 'soundcloud') {
      const error = new Error('SoundCloud stream unavailable');
      error.code = 'SOUNDCLOUD_STREAM_FAILURE';
      throw error;
    }

    const fallback = await yt.getStream(this.url, preferOpus);
    let stream = fallback.stream;
    let isOpus = fallback.isOpus;

    if (!isOpus && options.forceTranscode !== false) {
      stream = transcodeToOpus(stream, options.logger);
      isOpus = true;
    }

    const safeStream = new PassThrough();
    stream.pipe(safeStream);

    return {
      stream: safeStream,
      isOpus,
      metadata: fallback.metadata,
    };
  }

  async tryPlayDlStream({ seekSeconds, logger }) {
    const shouldUsePlayDl = ['youtube', 'soundcloud'].includes(this.source) || yt.isYouTubeUrl(this.url);
    if (!shouldUsePlayDl) return null;

    try {
      const baseOptions = { discordPlayerCompatibility: true };
      if (typeof seekSeconds === 'number') {
        baseOptions.seek = seekSeconds;
      }

      let result;
      if (this.prefetchInfo) {
        result = await playdl.stream_from_info(this.prefetchInfo, baseOptions);
      } else {
        result = await playdl.stream(this.url, baseOptions);
      }

      if (!result) return null;

      const metadata = {
        ...(result.streamInfo || {}),
        type: result.type,
        source: this.source,
      };
      const type = (result.type || '').toLowerCase();
      const isOpus = type.includes('opus');
      return {
        stream: result.stream,
        isOpus,
        metadata,
      };
    } catch (error) {
      if (this.source === 'soundcloud') {
        markSoundCloudFailure?.(error);
      }
      if (logger?.warn) {
        logger.warn(`play-dl stream fallback for "${this.title}": ${error.message}`);
      }
      return null;
    }
  }
}

module.exports = Track;
