const respond = require('../utils/respond');

module.exports = {
  name: 'resume',
  aliases: ['unpause', 'continue'],
  description: 'Resume playback if paused.',
  usage: '!resume',
  async execute(message, _args, context) {
    const { playerManager, prefix } = context;
    const resumed = playerManager.resume(message.guild.id);
    if (resumed) {
      await message.reply(respond.success({
        title: 'Playback Resumed',
        description: 'Enjoy the music! Use `!pause` anytime to halt playback.',
        user: message.author.tag,
      }));
    } else {
      await message.reply(respond.error({
        title: 'Nothing To Resume',
        description: `Start by queuing a track with \`${prefix}play <song>\`.`,
        user: message.author.tag,
      }));
    }
  },
};
