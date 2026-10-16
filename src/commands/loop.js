const respond = require('../utils/respond');

const MODES = ['off', 'track', 'queue'];

module.exports = {
  name: 'loop',
  description: 'Toggle loop modes: off, track, queue.',
  usage: '!loop [off|track|queue]',
  async execute(message, args, context) {
    const { playerManager, prefix } = context;
    let mode = args[0]?.toLowerCase();
    if (!MODES.includes(mode)) {
      const currentMode = playerManager.states?.get?.(message.guild.id)?.loopMode || 'off';
      const currentIndex = MODES.indexOf(currentMode);
      mode = MODES[(currentIndex + 1) % MODES.length];
    }
    const result = playerManager.setLoop(message.guild.id, mode);
    await message.reply(respond.success({
      title: 'Loop Mode Updated',
      description: `Looping is now set to **${result}**.`,
      user: message.author.tag,
      fields: [
        { name: 'Modes', value: '`off` → plays through queue once\n`track` → repeats current track\n`queue` → loops entire queue' },
        { name: 'Tip', value: `Use \`${prefix}loop <mode>\` to jump directly to a mode.` },
      ],
    }));
  },
};
