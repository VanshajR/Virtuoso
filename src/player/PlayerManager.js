const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const { Collection } = require('discord.js');
const GuildQueue = require('./queue');

class PlayerManager {
  constructor({
    logger,
    leaveTimeout = 120,
    preferOpus = true,
    youtubeEnabled = true,
    defaultVoteSkipRatio = 0.5,
    historyLimit = 20,
  }) {
    this.logger = logger;
    this.leaveTimeout = leaveTimeout * 1000;
    this.preferOpus = preferOpus;
    this.youtubeEnabled = youtubeEnabled;
    this.defaultVoteSkipRatio = Number.isFinite(defaultVoteSkipRatio) ? defaultVoteSkipRatio : 0.5;
    this.historyLimit = historyLimit;
    this.states = new Collection();
  }

  getState(guildId) {
    if (!guildId) return null;
    if (!this.states.has(guildId)) {
      const audioPlayer = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Stop },
      });
      const state = {
        audioPlayer,
        queue: new GuildQueue(),
        connection: null,
        current: null,
        loopMode: 'off',
        volume: 0.3,
        textChannelId: null,
        idleTimer: null,
        history: [],
        voteSkips: new Set(),
        trackStartedAt: null,
        trackOffset: 0,
        pausedAt: null,
      };
      this.attachAudioPlayerEvents(guildId, audioPlayer);
      this.states.set(guildId, state);
    }
    return this.states.get(guildId);
  }

  attachAudioPlayerEvents(guildId, audioPlayer) {
    audioPlayer.on(AudioPlayerStatus.Idle, () => {
      const state = this.states.get(guildId);
      if (!state) return;
      const finished = state.current;
      if (finished) {
        this.pushHistory(state, finished);
        if (state.loopMode === 'track') {
          state.queue.unshift(finished);
        } else if (state.loopMode === 'queue') {
          state.queue.add(finished);
        }
      }
      state.current = null;
      state.voteSkips.clear();
      this.playNext(guildId).catch((error) => this.logger?.error?.('playNext error', error));
    });

    audioPlayer.on('error', (error) => {
      this.logger?.error?.(`Audio player error in guild ${guildId}:`, error);
      this.playNext(guildId).catch((err) => this.logger?.error?.('Recovery playNext error', err));
    });
  }

  attachConnectionEvents(guildId, connection) {
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        this.logger?.warn?.(`Voice connection for guild ${guildId} disconnected, attempting to reconnect.`);
      } catch (error) {
        this.logger?.error?.(`Voice connection for guild ${guildId} failed to recover:`, error);
        this.stop(guildId);
      }
    });

    connection.on('error', (error) => this.logger?.error?.(`Voice connection error in guild ${guildId}:`, error));
  }

  bindTextChannel(guildId, channelId) {
    const state = this.getState(guildId);
    if (state) state.textChannelId = channelId;
  }

  async join(guildId, voiceChannel) {
    const state = this.getState(guildId);
    if (!voiceChannel) throw new Error('Join command requires a voice channel.');

    if (state.connection && state.connection.joinConfig.channelId === voiceChannel.id) {
      return state.connection;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    this.attachConnectionEvents(guildId, connection);
    state.connection = connection;
    connection.subscribe(state.audioPlayer);

    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    return connection;
  }

  async enqueue(guildId, track) {
    const state = this.getState(guildId);
    state.queue.add(track);
    this.prefetchNext(guildId);
    if (!state.current && state.audioPlayer.state.status !== AudioPlayerStatus.Playing) {
      await this.playNext(guildId);
    }
    return state.queue.length;
  }

  async playNext(guildId) {
    const state = this.getState(guildId);
    if (!state) return;

    if (!state.connection) {
      this.logger?.debug?.(`No connection for guild ${guildId}, cannot play.`);
      return;
    }

    const nextTrack = state.queue.shift();
    if (!nextTrack) {
      state.current = null;
      this.startIdleTimer(guildId);
      return;
    }

    await this.startTrack(guildId, nextTrack);
  }

  async startTrack(guildId, track, { seek = null, preserveHistory = false } = {}) {
    const state = this.getState(guildId);
    if (!state) return;

    try {
      const { stream, metadata, isOpus } = await track.createStream({
        preferOpus: this.preferOpus,
        youtubeEnabled: this.youtubeEnabled,
        logger: this.logger,
        seek,
      });
      const streamType = this.resolveStreamType(metadata, isOpus);
      const resource = createAudioResource(stream, {
        inputType: streamType,
        inlineVolume: streamType === StreamType.Arbitrary,
      });

      if (streamType === StreamType.Arbitrary && resource.volume) {
        resource.volume.setVolume(state.volume);
      }

      if (!preserveHistory && state.current) {
        this.pushHistory(state, state.current);
      }

      state.audioPlayer.play(resource);
      state.current = track;
      state.voteSkips.clear();
      this.recordPlaybackStart(state, seek);
      this.logQuality(track, metadata);
      this.clearIdleTimer(guildId);
      this.prefetchNext(guildId);
    } catch (error) {
      this.logger?.error?.(`Failed to start track in guild ${guildId}:`, error);
      if (!preserveHistory) {
        await this.playNext(guildId);
      } else {
        throw error;
      }
    }
  }

  recordPlaybackStart(state, seek) {
    state.trackStartedAt = Date.now();
    state.trackOffset = typeof seek === 'number' && seek >= 0 ? seek : 0;
    state.pausedAt = null;
  }

  logQuality(track, metadata = {}) {
    if (!metadata) return;
    const bitrate = metadata.abr ?? metadata.tbr ?? metadata.bitrate;
    const codec = metadata.acodec || metadata.codec || metadata.audioCodec;
    const container = metadata.container || metadata.ext || metadata.contentType;
    const qualityParts = [
      codec ? `codec=${codec}` : null,
      container ? `container=${container}` : null,
      bitrate ? `bitrate=${bitrate}kbps` : null,
      metadata.format_note ? `note=${metadata.format_note}` : null,
    ].filter(Boolean);
    this.logger?.info?.(
      `Streaming quality for "${track.title}": ${qualityParts.join(', ') || 'unknown'}`,
    );
  }

  pushHistory(state, track) {
    if (!track) return;
    state.history.unshift(track);
    if (state.history.length > this.historyLimit) {
      state.history.pop();
    }
  }

  prefetchNext(guildId) {
    const state = this.getState(guildId);
    if (!state) return;
    const upcoming = state.queue.peek?.();
    if (upcoming?.prefetch) {
      upcoming.prefetch().catch((error) => this.logger?.debug?.(`Prefetch failed: ${error.message}`));
    }
  }

  getPlaybackPosition(guildId) {
    const state = this.getState(guildId);
    if (!state?.current || !state.trackStartedAt) return 0;
    const anchor = state.pausedAt || Date.now();
    const elapsed = Math.max(0, (anchor - state.trackStartedAt) / 1000);
    return (state.trackOffset || 0) + elapsed;
  }

  async seekTo(guildId, seconds) {
    const state = this.getState(guildId);
    if (!state?.current) {
      throw new Error('Nothing is currently playing.');
    }
    const duration = state.current.duration || seconds;
    const bounded = Math.max(0, Math.min(seconds, duration || seconds));
    await this.startTrack(guildId, state.current, { seek: bounded, preserveHistory: true });
    return bounded;
  }

  async seekBy(guildId, deltaSeconds) {
    const currentPosition = this.getPlaybackPosition(guildId);
    return this.seekTo(guildId, currentPosition + deltaSeconds);
  }

  skip(guildId) {
    const state = this.getState(guildId);
    if (!state || !state.current) return null;
    const skipped = state.current;
    state.audioPlayer.stop(true);
    return skipped;
  }

  playPrevious(guildId) {
    const state = this.getState(guildId);
    if (!state || !state.history.length) return null;
    const previous = state.history.shift();
    if (state.current) {
      state.queue.unshift(state.current);
    }
    return this.startTrack(guildId, previous, { preserveHistory: true }).then(() => previous);
  }

  registerSkipVote(guildId, userId, voiceChannel, ratioOverride) {
    const state = this.getState(guildId);
    if (!state || !state.current) {
      return { skipped: false, reason: 'NOTHING_PLAYING' };
    }
    if (!voiceChannel) {
      return { skipped: false, reason: 'NO_VOICE' };
    }
    const ratio = Math.min(1, Math.max(0.1, ratioOverride ?? this.defaultVoteSkipRatio));
    state.voteSkips.add(userId);
    const nonBotMembers = voiceChannel.members.filter((member) => !member.user.bot);
    const required = Math.max(1, Math.ceil(nonBotMembers.size * ratio));
    const votes = state.voteSkips.size;
    if (votes >= required) {
      const skipped = this.skip(guildId);
      return { skipped: Boolean(skipped), reason: 'THRESHOLD_MET', votes, required };
    }
    return { skipped: false, reason: 'MORE_VOTES_NEEDED', votes, required };
  }

  stop(guildId) {
    const state = this.getState(guildId);
    if (!state) return;
    state.queue.clear();
    state.history = [];
    state.voteSkips.clear();
    state.current = null;
    state.audioPlayer.stop(true);
    if (state.connection) {
      state.connection.destroy();
      state.connection = null;
    }
    this.startIdleTimer(guildId, true);
  }

  leave(guildId) {
    const state = this.getState(guildId);
    if (!state) return;
    if (state.connection) {
      state.connection.destroy();
      state.connection = null;
    }
    this.startIdleTimer(guildId, true);
  }

  pause(guildId) {
    const state = this.getState(guildId);
    if (!state) return false;
    const success = state.audioPlayer.pause();
    if (success) {
      state.pausedAt = Date.now();
    }
    return success;
  }

  resume(guildId) {
    const state = this.getState(guildId);
    if (!state) return false;
    if (state.pausedAt) {
      const currentPosition = this.getPlaybackPosition(guildId);
      state.trackOffset = currentPosition;
      state.trackStartedAt = Date.now();
      state.pausedAt = null;
    }
    return state.audioPlayer.unpause();
  }

  setVolume(guildId, level) {
    const state = this.getState(guildId);
    if (!state) return false;
    state.volume = level;
    const resource = state.audioPlayer.state.resource;
    if (resource?.volume) {
      resource.volume.setVolume(level);
    }
    return true;
  }

  setLoop(guildId, mode) {
    const state = this.getState(guildId);
    if (!state) return 'off';
    state.loopMode = mode;
    return state.loopMode;
  }

  shuffle(guildId) {
    const state = this.getState(guildId);
    if (!state) return [];
    return state.queue.shuffle();
  }

  removeAt(guildId, index) {
    const state = this.getState(guildId);
    if (!state) return null;
    return state.queue.removeAt(index);
  }

  getQueue(guildId) {
    const state = this.getState(guildId);
    return state?.queue?.getAll() || [];
  }

  getNowPlaying(guildId) {
    const state = this.getState(guildId);
    return state?.current || null;
  }

  getHistory(guildId) {
    const state = this.getState(guildId);
    return state?.history || [];
  }

  clearIdleTimer(guildId) {
    const state = this.getState(guildId);
    if (state?.idleTimer) {
      clearTimeout(state.idleTimer);
      state.idleTimer = null;
    }
  }

  startIdleTimer(guildId, immediateLeave = false) {
    const state = this.getState(guildId);
    if (!state) return;
    this.clearIdleTimer(guildId);

    const timeout = immediateLeave ? 1_000 : this.leaveTimeout;
    state.idleTimer = setTimeout(() => {
      const currentState = this.getState(guildId);
      if (!currentState) return;
      if (currentState.connection) {
        this.logger?.info?.(`Leaving voice channel in guild ${guildId} after inactivity.`);
        currentState.connection.destroy();
        currentState.connection = null;
      }
    }, timeout);
  }

  resolveStreamType(metadata = {}, isOpus = false) {
    if (!isOpus) {
      return StreamType.Arbitrary;
    }

    const containerHints = [metadata.container, metadata.ext, metadata.contentType]
      .filter(Boolean)
      .map((value) => value.toString().toLowerCase());

    if (containerHints.some((value) => value.includes('webm'))) {
      return StreamType.WebmOpus;
    }

    return StreamType.Opus;
  }
}

module.exports = PlayerManager;
