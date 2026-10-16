const { PermissionsBitField } = require('discord.js');
const { setPrefix, clearPrefix } = require('../utils/guildUtils');
const respond = require('../utils/respond');

module.exports = {
  name: 'prefix',
  description: 'View or update the guild-specific command prefix.',
  usage: '!prefix [newPrefix|reset]',
  async execute(message, args, context) {
    const { prefix } = context;
    if (!args.length) {
      await message.reply(respond.success({
        title: 'Current Prefix',
        description: `Commands start with \`${prefix}\`.`,
        user: message.author.tag,
      }));
      return;
    }

    if (!message.member?.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      await message.reply(respond.error({
        title: 'Permission Required',
        description: 'You need the **Manage Server** permission to update the prefix.',
        user: message.author.tag,
      }));
      return;
    }

    const next = args[0].toLowerCase();
    if (next === 'reset') {
      clearPrefix(message.guild.id);
      await message.reply(respond.success({
        title: 'Prefix Reset',
        description: 'Reverted to the global default prefix `!`.',
        user: message.author.tag,
      }));
      return;
    }

    const newPrefix = args[0];
    if (newPrefix.length > 5) {
      await message.reply(respond.error({
        title: 'Prefix Too Long',
        description: 'Please keep the prefix to 5 characters or fewer.',
        user: message.author.tag,
      }));
      return;
    }
    setPrefix(message.guild.id, newPrefix);
    await message.reply(respond.success({
      title: 'Prefix Updated',
      description: `Commands now begin with \`${newPrefix}\`.`,
      user: message.author.tag,
    }));
  },
};
