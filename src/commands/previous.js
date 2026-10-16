const respond = require('../utils/respond');

module.exports = {
  name: 'previous',
  aliases: ['back'],
  description: 'Play the previously played track.',
  usage: '!previous',
  async execute(message, _args, context) {
    const { playerManager, prefix } = context;
    const botChannelId = message.guild.members.me?.voice?.channelId;
    if (!botChannelId) {
      await message.reply(respond.error({
        title: 'Nothing to replay',
        description: `Use \`${prefix}play\` to queue songs first.`,
        user: message.author.tag,
      }));
      return;
    }

    if (message.member?.voice?.channelId !== botChannelId) {
      await message.reply(respond.error({
        title: 'Join my voice channel',
        description: 'You need to be in the same voice channel to use previous.',
        user: message.author.tag,
      }));
      return;
    }

    const history = playerManager.getHistory(message.guild.id);
    if (!history?.length) {
      await message.reply(respond.error({
        title: 'History empty',
        description: 'There are no previously played tracks to return to yet.',
        user: message.author.tag,
      }));
      return;
    }

    try {
      const track = await playerManager.playPrevious(message.guild.id);
      if (!track) {
        await message.reply(respond.error({
          title: 'Unable to start previous track',
          description: 'Try again in a moment.',
          user: message.author.tag,
        }));
        return;
      }

      await message.reply(respond.success({
        title: 'Back to previous track',
        description: `Replaying **${track.title}**. Enjoy the rewind!`,
        user: message.author.tag,
      }));
    } catch (error) {
      context.logger?.error?.('Previous command failed:', error);
      await message.reply(respond.error({
        title: 'Failed to start previous track',
        description: 'I hit an issue restarting the previous song. Try again in a bit.',
        user: message.author.tag,
      }));
    }
  },
};
