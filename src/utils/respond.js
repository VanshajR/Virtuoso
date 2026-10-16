const { EmbedBuilder } = require('discord.js');

const COLORS = {
  success: 0x5865f2,
  error: 0xed4245,
  info: 0x2f3136,
};

function buildEmbed({ title, description, user, color = COLORS.info, fields = [], footer }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setTimestamp();

  if (description) embed.setDescription(description);
  if (fields.length) embed.addFields(fields);
  if (footer) {
    embed.setFooter(footer);
  } else if (user) {
    embed.setFooter({ text: `Requested by ${user}` });
  }

  return embed;
}

function success(payload) {
  const embed = buildEmbed({ color: COLORS.success, ...payload });
  return { embeds: [embed] };
}

function error(payload) {
  const embed = buildEmbed({ color: COLORS.error, ...payload });
  return { embeds: [embed] };
}

function info(payload) {
  const embed = buildEmbed({ color: COLORS.info, ...payload });
  return { embeds: [embed] };
}

module.exports = {
  success,
  error,
  info,
};
