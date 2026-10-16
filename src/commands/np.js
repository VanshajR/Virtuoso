const respond = require('../utils/respond');
const { formatDuration, formatProgress } = require('../utils/format');

module.exports = {
  name: 'np',
  description: 'Shows the currently playing track.',
  usage: '!np',
  async execute(message, _args, context) {
    const { playerManager } = context;
    const track = playerManager.getNowPlaying(message.guild.id);
    if (!track) {
      await message.reply(respond.error({
        title: 'Nothing Playing',
        description: 'Queue something with `!play <song>` and I will join you automatically.',
        user: message.author.tag,
      }));
      return;
    }

    const position = playerManager.getPlaybackPosition(message.guild.id);
    const duration = track.duration || track.raw?.duration;

    await message.reply(respond.success({
      title: 'Now Playing',
      description: `[${track.title}](${track.url})`,
      user: track.requestedBy,
      fields: [
        { name: 'Duration', value: formatDuration(duration), inline: true },
        { name: 'Progress', value: formatProgress(position, duration), inline: true },
        { name: 'Source', value: track.source || 'unknown', inline: true },
      ],
    }));
  },
};
