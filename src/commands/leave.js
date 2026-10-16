const respond = require('../utils/respond');

module.exports = {
  name: 'leave',
  description: 'Disconnect the bot from the voice channel.',
  usage: '!leave',
  async execute(message, _args, context) {
    const { playerManager } = context;
    playerManager.leave(message.guild.id);
    await message.reply(respond.success({
      title: 'Disconnected',
      description: 'Left the voice channel and freed resources. Use `!play` to summon me again.',
      user: message.author.tag,
    }));
  },
};
