const respond = require('../utils/respond');
const { parseTimestamp, formatDuration } = require('../utils/format');

function guardChannel(message) {
  const botChannelId = message.guild.members.me?.voice?.channelId;
  if (!botChannelId) return 'I am not in a voice channel to control.';
  if (message.member?.voice?.channelId !== botChannelId) {
    return 'Join my voice channel to rewind the track.';
  }
  return null;
}

module.exports = {
  name: 'rewind',
  aliases: ['rw'],
  description: 'Rewind the current track (default 10s).',
  usage: '!rewind [seconds|mm:ss]',
  async execute(message, args, context) {
    const guard = guardChannel(message);
    if (guard) {
      await message.reply(respond.error({
        title: 'Cannot rewind',
        description: guard,
        user: message.author.tag,
      }));
      return;
    }

    const raw = args[0];
    const parsed = raw ? parseTimestamp(raw) : 10;
    if (Number.isNaN(parsed) || parsed <= 0) {
      await message.reply(respond.error({
        title: 'Invalid duration',
        description: 'Provide a positive number of seconds or mm:ss.',
        user: message.author.tag,
      }));
      return;
    }

    try {
      const position = await context.playerManager.seekBy(message.guild.id, -parsed);
      await message.reply(respond.success({
        title: 'Rewound',
        description: `Current position: **${formatDuration(position)}**.`,
        user: message.author.tag,
      }));
    } catch (error) {
      context.logger?.error?.('Rewind command failed:', error);
      await message.reply(respond.error({
        title: 'Rewind failed',
        description: error.message || 'Unable to adjust the playback position.',
        user: message.author.tag,
      }));
    }
  },
};
