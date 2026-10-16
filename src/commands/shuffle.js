const respond = require('../utils/respond');

module.exports = {
  name: 'shuffle',
  description: 'Shuffle the current queue.',
  usage: '!shuffle',
  async execute(message, _args, context) {
    const { playerManager } = context;
    const queue = playerManager.getQueue(message.guild.id);
    if (!queue.length) {
      await message.reply(respond.error({
        title: 'Queue Empty',
        description: 'Add a few songs first, then shuffle away!',
        user: message.author.tag,
      }));
      return;
    }
    playerManager.shuffle(message.guild.id);
    await message.reply(respond.success({
      title: 'Queue Shuffled',
      description: `Randomized ${queue.length} upcoming tracks.`,
      user: message.author.tag,
    }));
  },
};
