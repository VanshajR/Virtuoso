const respond = require('../utils/respond');

module.exports = {
  name: 'help',
  description: 'Display command help.',
  usage: '!help',
  async execute(message, _args, context) {
    const { commands, prefix } = context;
    const uniqueCommands = [...new Map([...commands.values()].map((cmd) => [cmd.name, cmd])).values()];
    const fields = uniqueCommands.slice(0, 25).map((cmd) => ({
      name: `${prefix}${cmd.name}`,
      value: `${cmd.description || 'No description provided.'}\nUsage: \`${cmd.usage || 'N/A'}\``,
    }));

    const messagePayload = respond.success({
      title: 'Virtuoso Command Reference',
      description: `Current prefix: \`${prefix}\`. Use \`${prefix}play <song>\` to have Virtuoso join your voice channel automatically and start playback.`,
      fields,
      user: message.author.tag,
    });

    await message.reply(messagePayload);
  },
};
