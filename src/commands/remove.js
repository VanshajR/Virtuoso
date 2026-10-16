const respond = require('../utils/respond');

module.exports = {
  name: 'remove',
  description: 'Remove a track from the queue by its position.',
  usage: '!remove <position>',
  async execute(message, args, context) {
    const { playerManager } = context;
    if (!args.length) {
      await message.reply(respond.error({
        title: 'Queue Position Missing',
        description: 'Provide the number shown in `!queue`, e.g. `!remove 3`.',
        user: message.author.tag,
      }));
      return;
    }
    const index = Number(args[0]) - 1;
    if (Number.isNaN(index) || index < 0) {
      await message.reply(respond.error({
        title: 'Invalid Position',
        description: 'Position must be a positive number.',
        user: message.author.tag,
      }));
      return;
    }
    const removed = playerManager.removeAt(message.guild.id, index);
    if (!removed) {
      await message.reply(respond.error({
        title: 'Nothing Removed',
        description: 'No track exists at that slot. Use `!queue` to double-check the indexes.',
        user: message.author.tag,
      }));
      return;
    }
    await message.reply(respond.success({
      title: 'Track Removed',
      description: `Removed **${removed.title}** from the queue.`,
      user: message.author.tag,
    }));
  },
};
