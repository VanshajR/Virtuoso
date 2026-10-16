const respond = require('../utils/respond');
const { resolveTrack, getSoundCloudStatus } = require('../utils/mediaResolver');
const { queueTrack } = require('../services/queueTrack');
const yt = require('../utils/yt');

module.exports = {
  name: 'play',
  aliases: ['p'],
  description: 'Play a track from a URL or search query.',
  usage: '!play <url|keywords>',
  async execute(message, args, context) {
    const { config, prefix, guildSettings, logger } = context;
    if (!args.length) {
      await message.reply(respond.error({
        title: 'No Search Query Provided',
        description: `Use \`${prefix}play <song name or URL>\`.`,
        user: message.author.tag,
      }));
      return;
    }

    const trimmedArgs = [];
    let forceYouTube = false;
    args.forEach((arg) => {
      const lowered = arg.toLowerCase();
      if (['--yt', '--youtube', '-y'].includes(lowered)) {
        forceYouTube = true;
      } else {
        trimmedArgs.push(arg);
      }
    });

    const query = trimmedArgs.join(' ');
    if (!query.length) {
      await message.reply(respond.error({
        title: 'Empty Query',
        description: `After the flag, provide keywords or a link. Example: \`${prefix}play --yt song name\`.`,
        user: message.author.tag,
      }));
      return;
    }

    const preferSoundCloud = !forceYouTube && (guildSettings?.preferSoundCloud ?? config.preferSoundCloud);

    let trackData;
    try {
      trackData = await resolveTrack(query, {
        preferSoundCloud,
        forceYouTube,
        allowYouTube: config.youtubeEnabled,
        logger,
      });
    } catch (error) {
      context.logger?.error?.('Failed to resolve track:', error);
    }

    if (!trackData) {
      const scStatus = getSoundCloudStatus();
      let description = 'Try a more specific search query, include the artist, or paste a direct link.';
      if (scStatus?.lastError?.code === 401) {
        description += '\nSoundCloud is rejecting the configured client ID (401). Update `SOUNDCLOUD_CLIENT_ID` or disable SoundCloud preference via `!settings preferSC off`.';
      }
      await message.reply(respond.error({
        title: 'No Results Found',
        description,
        user: message.author.tag,
      }));
      return;
    }

    if (!config.youtubeEnabled && yt.isYouTubeUrl(trackData.url)) {
      await message.reply(respond.error({
        title: 'YouTube Disabled',
        description: 'The bot owner has disabled YouTube playback. Use a SoundCloud link or enable SoundCloud-first search.',
        user: message.author.tag,
      }));
      return;
    }

    try {
      const result = await queueTrack({
        member: message.member,
        textChannel: message.channel,
        trackData,
        context,
      });
      const scStatus = getSoundCloudStatus();
      if (scStatus?.lastError?.code === 401) {
        result.embed.addFields({
          name: 'SoundCloud Notice',
          value: 'SoundCloud is returning 401 (unauthorized). I will prefer YouTube until a valid `SOUNDCLOUD_CLIENT_ID` is configured.',
        });
      }

      await message.reply({ embeds: [result.embed] });
    } catch (error) {
      if (error.message === 'VOICE_REQUIRED') {
        await message.reply(respond.error({
          title: 'Join A Voice Channel First',
          description: 'Hop into a voice channel and run the command again so I know where to play music.',
          user: message.author.tag,
        }));
        return;
      }

      context.logger?.error?.('Failed to play track:', error);
      await message.reply(respond.error({
        title: 'Playback Failed',
        description: 'I could not join the voice channel or create the audio stream. Check my permissions and try again.',
        user: message.author.tag,
      }));
    }
  },
};
