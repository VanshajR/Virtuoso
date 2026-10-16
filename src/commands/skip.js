const respond = require('../utils/respond');
const { isCommander } = require('../utils/permissions');

module.exports = {
  name: 'skip',
  aliases: ['next'],
  description: 'Skip the current track.',
  usage: '!skip',
  async execute(message, _args, context) {
    const { playerManager, prefix, guildSettings, config } = context;
    const current = playerManager.getNowPlaying(message.guild.id);
    if (!current) {
      await message.reply(respond.error({
        title: 'Nothing Playing',
        description: `Queue something with \`${prefix}play <song>\` first.`,
        user: message.author.tag,
      }));
      return;
    }

    const member = message.member;
    const commander = isCommander(member, message.guild.id);
    const voteSkipEnabled = guildSettings?.voteSkipEnabled;

    if (voteSkipEnabled && !commander) {
      const voiceChannel = member?.voice?.channel;
      if (!voiceChannel) {
        await message.reply(respond.error({
          title: 'Join The Voice Channel',
          description: 'Vote skips require you to be in the same voice channel as me.',
          user: message.author.tag,
        }));
        return;
      }

      const botChannelId = message.guild.members.me?.voice?.channelId;
      if (!botChannelId || voiceChannel.id !== botChannelId) {
        await message.reply(respond.error({
          title: 'Wrong voice channel',
          description: 'Vote skips only count from the voice channel currently playing music.',
          user: message.author.tag,
        }));
        return;
      }

      const ratio = guildSettings?.voteSkipRatio ?? config.voteSkipRatio;
      const result = playerManager.registerSkipVote(
        message.guild.id,
        message.author.id,
        voiceChannel,
        ratio,
      );

      if (result.skipped) {
        await message.reply(respond.success({
          title: 'Track Skipped',
          description: `Vote threshold reached. Skipped **${current.title}**.`,
          user: message.author.tag,
        }));
        return;
      }

      const needed = Math.max(0, (result.required || 0) - (result.votes || 0));
      await message.reply(respond.info({
        title: 'Vote Registered',
        description: `Need **${needed}** more vote(s) to skip **${current.title}** (${result.votes || 0}/${result.required || 0}).`,
        user: message.author.tag,
      }));
      return;
    }

    const skipped = playerManager.skip(message.guild.id);
    if (!skipped) {
      await message.reply(respond.error({
        title: 'Nothing Playing',
        description: `Queue something with \`${prefix}play <song>\` first.`,
        user: message.author.tag,
      }));
      return;
    }

    await message.reply(respond.success({
      title: 'Track Skipped',
      description: `Skipped **${skipped.title}**. Loading the next track now...`,
      user: message.author.tag,
    }));
  },
};
