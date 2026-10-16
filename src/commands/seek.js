const respond = require('../utils/respond');
const { parseTimestamp, formatDuration } = require('../utils/format');

function ensureSameChannel(message) {
  const botChannelId = message.guild.members.me?.voice?.channelId;
  if (!botChannelId) return 'I am not in a voice channel right now.';
  if (message.member?.voice?.channelId !== botChannelId) {
    return 'Join my voice channel to control playback.';
  }
  return null;
}

module.exports = {
  name: 'seek',
  description: 'Seek to a specific timestamp (mm:ss or seconds).',
  usage: '!seek <mm:ss|seconds>',
  async execute(message, args, context) {
    const { playerManager } = context;
    const guard = ensureSameChannel(message);
    if (guard) {
      await message.reply(respond.error({
        title: 'Unable to seek',
        description: guard,
        user: message.author.tag,
      }));
      return;
    }

    if (!args.length) {
      await message.reply(respond.error({
        title: 'Provide a timestamp',
        description: 'Example: `!seek 1:23`',
        user: message.author.tag,
      }));
      return;
    }

    const target = parseTimestamp(args[0]);
    if (Number.isNaN(target)) {
      await message.reply(respond.error({
        title: 'Invalid timestamp',
        description: 'Use seconds or mm:ss / hh:mm:ss format.',
        user: message.author.tag,
      }));
      return;
    }

    try {
      const actual = await playerManager.seekTo(message.guild.id, target);
      await message.reply(respond.success({
        title: 'Seek successful',
        description: `Jumped to **${formatDuration(actual)}** in the current track.`,
        user: message.author.tag,
      }));
    } catch (error) {
      context.logger?.error?.('Seek command failed:', error);
      await message.reply(respond.error({
        title: 'Seek failed',
        description: error.message || 'I could not restart the track at that time.',
        user: message.author.tag,
      }));
    }
  },
};
