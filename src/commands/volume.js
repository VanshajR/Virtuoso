const respond = require('../utils/respond');

module.exports = {
  name: 'volume',
  description: 'Set playback volume (0-200%).',
  usage: '!volume <0-200>',
  async execute(message, args, context) {
    const { playerManager } = context;
    if (!args.length) {
      await message.reply(respond.error({
        title: 'Volume Missing',
        description: 'Provide a percentage between 0 and 200, e.g. `!volume 75`.',
        user: message.author.tag,
      }));
      return;
    }
    const raw = Number(args[0]);
    if (Number.isNaN(raw)) {
      await message.reply(respond.error({
        title: 'Invalid Number',
        description: 'Volume must be numeric.',
        user: message.author.tag,
      }));
      return;
    }
    const percent = Math.min(Math.max(raw, 0), 200);
    const volume = percent / 100;
    const previous = playerManager.getState(message.guild.id)?.volume ?? 0.3;
    playerManager.setVolume(message.guild.id, volume);
    await message.reply(respond.success({
      title: 'Volume Updated',
      description: `Set volume to **${percent}%** (was ${(previous * 100).toFixed(0)}%).`,
      user: message.author.tag,
    }));
  },
};
