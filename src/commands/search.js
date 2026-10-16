const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const crypto = require('crypto');
const respond = require('../utils/respond');
const { dualSearch } = require('../utils/mediaResolver');
const { formatDuration } = require('../utils/format');

function chunk(array, size) {
  const batches = [];
  for (let i = 0; i < array.length; i += size) {
    batches.push(array.slice(i, i + size));
  }
  return batches;
}

module.exports = {
  name: 'search',
  description: 'Search YouTube and SoundCloud with interactive results.',
  usage: '!search <keywords>',
  async execute(message, args, context) {
    const { config, searchSessions, prefix } = context;
    if (!args.length) {
      await message.reply(respond.error({
        title: 'Missing search terms',
        description: `Use \`${prefix}search <keywords>\` to look up music.`,
        user: message.author.tag,
      }));
      return;
    }

    const query = args.join(' ');
    await message.channel.sendTyping();
    let results;
    try {
      results = await dualSearch(query, { perSource: config.searchResults || 5 });
    } catch (error) {
      context.logger?.error?.('Search command failed:', error);
    }

    const soundcloud = results?.soundcloud || [];
    const youtube = results?.youtube || [];

    if (!soundcloud.length && !youtube.length) {
      await message.reply(respond.error({
        title: 'No matches found',
        description: 'Try a more specific query or switch sources with `--yt` on the play command.',
        user: message.author.tag,
      }));
      return;
    }

    const combined = [...soundcloud, ...youtube].slice(0, 25);
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + (config.searchTimeoutMs || 60_000);
    searchSessions.set(sessionId, {
      id: sessionId,
      guildId: message.guild.id,
      channelId: message.channel.id,
      userId: message.author.id,
      query,
      prefix,
      results: combined,
      expiresAt,
    });

    const describeGroup = (items, label) => {
      if (!items.length) return `No ${label} matches.`;
      return items
        .map((track, index) => `**${index + 1}.** [${track.title}](${track.url}) • ${formatDuration(track.duration)}${track.artist ? ` — ${track.artist}` : ''}`)
        .join('\n');
    };

    const indexedButtons = combined.map((track, index) => ({ track, index }));
    const rows = chunk(indexedButtons, 5).map((group) => new ActionRowBuilder()
      .addComponents(...group.map(({ track, index }) => new ButtonBuilder()
        .setCustomId(`virt.search:${sessionId}:${index}`)
        .setLabel(`${track.source === 'soundcloud' ? 'SC' : 'YT'} ${index + 1}`)
        .setStyle(track.source === 'soundcloud' ? ButtonStyle.Secondary : ButtonStyle.Primary))));

    const response = respond.info({
      title: 'Multi-source search results',
      description: `Use the buttons below to queue a result. Session active for ${Math.round((expiresAt - Date.now()) / 1000)} seconds.`,
      user: message.author.tag,
      fields: [
        { name: 'SoundCloud', value: describeGroup(soundcloud, 'SoundCloud') },
        { name: 'YouTube', value: describeGroup(youtube, 'YouTube') },
      ],
    });

    await message.reply({ ...response, components: rows });
  },
};
