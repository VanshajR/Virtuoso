const { EmbedBuilder } = require('discord.js');
const Track = require('../player/Track');
const { formatDuration } = require('../utils/format');
const yt = require('../utils/yt');

async function queueTrack({ member, textChannel, trackData, context }) {
  const { playerManager, config, logger } = context;
  if (!member?.voice?.channel) {
    throw new Error('VOICE_REQUIRED');
  }

  const guildId = member.guild.id;
  await playerManager.join(guildId, member.voice.channel);
  playerManager.bindTextChannel(guildId, textChannel.id);

  const track = new Track({ ...trackData, requestedBy: member.user.tag });
  const wasIdle = !playerManager.getNowPlaying(guildId);
  const queuePosition = await playerManager.enqueue(guildId, track);

  const embed = buildEmbed({
    track,
    member,
    voiceChannel: member.voice.channel,
    wasIdle,
    queuePosition,
    config,
  });

  if (yt.isYouTubeUrl(track.url) && config.youtubeEnabled) {
    logger?.warn?.('Playing YouTube audio. Ensure this aligns with the platform TOS.');
  }

  return { embed, track, queuePosition, wasIdle };
}

function buildEmbed({ track, member, voiceChannel, wasIdle, queuePosition, config }) {
  const embed = new EmbedBuilder()
    .setColor('#2f3136')
    .setTitle(wasIdle ? 'Now playing' : 'Added to queue')
    .setDescription(`[${track.title}](${track.url})`)
    .addFields(
      { name: 'Requested by', value: member.toString(), inline: true },
      { name: 'Duration', value: formatDuration(track.duration), inline: true },
      { name: 'Voice Channel', value: voiceChannel.name, inline: true },
    )
    .setTimestamp();

  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  if (track.source) {
    embed.addFields({ name: 'Source', value: track.source, inline: true });
  }
  if (!wasIdle) {
    embed.addFields({ name: 'Queue position', value: `#${queuePosition}`, inline: true });
  }

  if (!config.youtubeEnabled && yt.isYouTubeUrl(track.url)) {
    embed.setFooter({ text: 'Warning: YouTube playback is disabled in config.' });
  }

  return embed;
}

module.exports = {
  queueTrack,
  buildEmbed,
};
