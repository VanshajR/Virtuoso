const respond = require('../utils/respond');

module.exports = {
  name: 'join',
  description: 'Make the bot join your voice channel.',
  usage: '!join',
  async execute(message, _args, context) {
    const { playerManager, prefix } = context;
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      await message.reply(respond.error({
        title: 'No Voice Channel Detected',
        description: `Join a voice channel, then use \`${prefix}join\` or go straight to \`${prefix}play\`.`,
        user: message.author.tag,
      }));
      return;
    }

    try {
      await playerManager.join(message.guild.id, voiceChannel);
      playerManager.bindTextChannel(message.guild.id, message.channel.id);
      await message.reply(respond.success({
        title: 'Voice Channel Connected',
        description: `Ready to play music in **${voiceChannel.name}**. Use \`${prefix}play <song>\` to start playback immediately.`,
        user: message.author.tag,
        fields: [{ name: 'Auto-Join', value: 'Virtuoso also auto-joins when you use the play command.' }],
      }));
    } catch (error) {
      await message.reply(respond.error({
        title: 'Join Failed',
        description: 'I could not connect to that channel. Check my permissions and try again.',
        user: message.author.tag,
      }));
    }
  },
};
