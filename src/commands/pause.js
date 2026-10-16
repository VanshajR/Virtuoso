const respond = require('../utils/respond');

module.exports = {
  name: 'pause',
  description: 'Pause the current track.',
  usage: '!pause',
  async execute(message, _args, context) {
    const { playerManager, prefix } = context;
    const paused = playerManager.pause(message.guild.id);
    if (paused) {
      await message.reply(respond.success({
        title: 'Playback Paused',
        description: 'Use `!resume` when you are ready to continue.',
        user: message.author.tag,
      }));
    } else {
      await message.reply(respond.error({
        title: 'Nothing To Pause',
        description: `Queue a song with \`${prefix}play\` first.`,
        user: message.author.tag,
      }));
    }
  },
};
