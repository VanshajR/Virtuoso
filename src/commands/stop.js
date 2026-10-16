const respond = require('../utils/respond');
const { isCommander } = require('../utils/permissions');

module.exports = {
  name: 'stop',
  description: 'Stop playback and clear the queue.',
  usage: '!stop',
  async execute(message, _args, context) {
    const { playerManager, guildSettings, config } = context;
    const restricted = guildSettings?.stopRestricted ?? config.stopRestricted;
    if (restricted) {
      const commander = isCommander(message.member, message.guild.id);
      const botChannelId = message.guild.members.me?.voice?.channelId;
      const voiceChannel = message.member?.voice?.channel;

      if (!botChannelId) {
        await message.reply(respond.error({
          title: 'Not connected',
          description: 'I am not in a voice channel right now.',
          user: message.author.tag,
        }));
        return;
      }

      if (!voiceChannel || voiceChannel.id !== botChannelId) {
        await message.reply(respond.error({
          title: 'Join my voice channel',
          description: 'You must be in the same channel as me to use stop.',
          user: message.author.tag,
        }));
        return;
      }

      const humanCount = voiceChannel.members.filter((member) => !member.user.bot).size;
      if (!commander && humanCount > 1) {
        await message.reply(respond.error({
          title: 'Commander required',
          description: 'Only admins/commanders can stop playback unless you are alone in the channel.',
          user: message.author.tag,
        }));
        return;
      }
    }

    const pending = playerManager.getQueue(message.guild.id).length;
    const current = playerManager.getNowPlaying(message.guild.id);
    playerManager.stop(message.guild.id);
    await message.reply(respond.success({
      title: 'Playback Stopped',
      description: 'Cleared the queue and disconnected from voice.',
      user: message.author.tag,
      fields: [
        { name: 'Tracks Cleared', value: String(pending + (current ? 1 : 0)), inline: true },
      ],
    }));
  },
};
