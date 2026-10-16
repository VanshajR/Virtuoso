const respond = require('../utils/respond');
const { formatDuration } = require('../utils/format');

module.exports = {
  name: 'queue',
  description: 'Display the current queue.',
  usage: '!queue',
  async execute(message, args, context) {
    const { playerManager, prefix } = context;
    const page = Math.max(parseInt(args[0], 10) || 1, 1);
    const pageSize = 10;
    const queue = playerManager.getQueue(message.guild.id);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const slice = queue.slice(start, end);
    const current = playerManager.getNowPlaying(message.guild.id);

    if (!current && !queue.length) {
      await message.reply(respond.error({
        title: 'Queue Empty',
        description: `Add songs with \`${prefix}play <song>\` and I will join automatically.`,
        user: message.author.tag,
      }));
      return;
    }

    const fields = [];
    const totalDuration = [...(current ? [current] : []), ...queue]
      .reduce((sum, track) => sum + (track?.duration || 0), 0);
    if (current) {
      fields.push({
        name: 'Now Playing',
        value: `[${current.title}](${current.url}) • ${formatDuration(current.duration)} • Requested by ${current.requestedBy}`,
      });
    }

    if (slice.length) {
      const lines = slice.map((track, index) => `**${start + index + 1}.** [${track.title}](${track.url}) • ${formatDuration(track.duration)} • ${track.requestedBy}`);
      fields.push({ name: 'Up Next', value: lines.join('\n') });
    } else {
      fields.push({ name: 'Up Next', value: 'No upcoming tracks.' });
    }

    const helperLines = [
      `\`${prefix}remove <#>\` • remove an item`,
      `\`${prefix}shuffle\` • randomize upcoming tracks`,
      `\`${prefix}seek mm:ss\` • jump to a moment`,
      `\`${prefix}previous\` • replay last track`,
    ];

    fields.push({
      name: 'Helpful Commands',
      value: helperLines.join('\n'),
    });

    const response = respond.success({
      title: `Virtuoso Queue — Page ${page}`,
      description: `Showing ${slice.length} of ${queue.length} queued tracks. Total time queued: ${formatDuration(totalDuration)}.`,
      user: message.author.tag,
      fields,
    });

    await message.reply(response);
  },
};
