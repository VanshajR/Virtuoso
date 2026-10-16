const { Client, Events, GatewayIntentBits, Partials } = require('discord.js');
const playdl = require('play-dl');
const express = require('express');
const { config, validateConfig } = require('./config');
const createLogger = require('./logger');
const { loadCommands, runCommand } = require('./handlers/commandHandler');
const { registerInteractions, handleInteraction } = require('./handlers/interactionHandler');
const PlayerManager = require('./player/PlayerManager');
const { getPrefix } = require('./utils/guildUtils');
const { getSettings: getGuildSettings, updateSettings: updateGuildSettings } = require('./utils/guildSettings');
const { queueTrack } = require('./services/queueTrack');
const { isCommander } = require('./utils/permissions');

validateConfig();
const logger = createLogger(config.logLevel);

if (config.soundcloudClientId) {
  playdl.setToken({ soundcloud: { client_id: config.soundcloudClientId } });
  logger.info('Configured SoundCloud client for play-dl.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const commands = loadCommands(logger);
const playerManager = new PlayerManager({
  logger,
  leaveTimeout: config.leaveTimeout,
  preferOpus: config.preferOpus,
  youtubeEnabled: config.youtubeEnabled,
  defaultVoteSkipRatio: config.voteSkipRatio,
});
const searchSessions = new Map();
const SEARCH_SWEEP_INTERVAL = setInterval(() => {
  const now = Date.now();
  [...searchSessions.keys()].forEach((key) => {
    const session = searchSessions.get(key);
    if (!session || session.expiresAt <= now) {
      searchSessions.delete(key);
    }
  });
}, 30_000);
if (SEARCH_SWEEP_INTERVAL.unref) SEARCH_SWEEP_INTERVAL.unref();

const contextBase = { client, config, playerManager, logger, commands, searchSessions };

client.once(Events.ClientReady, () => {
  logger.info(`Virtuoso logged in as ${client.user.tag}`);
  if (config.youtubeEnabled) {
    logger.warn('YouTube playback enabled. Ensure compliance with YouTube Terms of Service.');
  }

  registerInteractions(client, logger);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const prefix = getPrefix(message.guild.id, config.prefix);
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;

  const guildSettings = getGuildSettings(message.guild.id);
  const context = {
    ...contextBase,
    prefix,
    guildId: message.guild.id,
    guildSettings,
    updateGuildSettings: (patch) => updateGuildSettings(message.guild.id, patch),
  };

  try {
    const executed = await runCommand(commands, commandName, message, args, context);
    if (!executed) {
      await message.reply(`Unknown command. Use \`${prefix}help\` to see available commands.`);
    }
  } catch (error) {
    logger.error('Command execution error:', error);
    await message.reply('There was an error executing that command. Please try again later.');
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const handled = await handleInteraction(interaction, { logger });
      if (handled) return;
    }

    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('virt.search:')) return;

    const [, sessionId, indexRaw] = interaction.customId.split(':');
    const session = searchSessions.get(sessionId);
    if (!session || session.guildId !== interaction.guildId) {
      await interaction.reply({ content: 'This search session is no longer available.', ephemeral: true });
      return;
    }

    if (session.expiresAt <= Date.now()) {
      searchSessions.delete(sessionId);
      await interaction.reply({ content: 'This search session expired. Run the search again.', ephemeral: true });
      return;
    }

    const resultIndex = Number(indexRaw);
    const trackData = session.results[resultIndex];
    if (!trackData) {
      await interaction.reply({ content: 'That result is no longer available.', ephemeral: true });
      return;
    }

    const allowed = interaction.user.id === session.userId || isCommander(interaction.member, interaction.guildId);
    if (!allowed) {
      await interaction.reply({ content: 'Only the requester or a commander can queue from this search.', ephemeral: true });
      return;
    }

    try {
      await interaction.deferReply({ ephemeral: true });
      const guildSettings = getGuildSettings(interaction.guildId);
      const playContext = {
        ...contextBase,
        prefix: session.prefix,
        guildId: interaction.guildId,
        guildSettings,
      };
      const result = await queueTrack({
        member: interaction.member,
        textChannel: interaction.channel,
        trackData,
        context: playContext,
      });

      await interaction.channel.send({ embeds: [result.embed] });
      await interaction.editReply({ content: `Queued **${trackData.title}**.` });
    } catch (error) {
      logger.error('Failed to queue via search interaction:', error);
      const message = error.message === 'VOICE_REQUIRED'
        ? 'Join a voice channel and try again.'
        : 'Unable to queue that track. Try another result.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: message });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    }
  } catch (error) {
    logger.error('Interaction handling error:', error);
    if (interaction.isRepliable?.() && !interaction.replied) {
      await interaction.reply({ content: 'There was a problem handling that interaction.', ephemeral: true });
    }
  }
});

async function shutdown() {
  logger.info('Shutting down, cleaning resources...');
  playerManager.states?.forEach((_, guildId) => playerManager.stop(guildId));
  clearInterval(SEARCH_SWEEP_INTERVAL);
  await client.destroy();
  process.exit(0); // eslint-disable-line no-process-exit
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const port = config.port || process.env.PORT || 3000;
const app = express();
app.get('/', (_, res) => res.status(200).send('Virtuoso OK'));
app.get('/health', (_, res) => res.status(200).json({ status: 'ok' }));
app.listen(port, () => logger.info(`Health server listening on port ${port}`));

client.login(config.token).catch((error) => {
  logger.error('Discord login failed:', error);
  process.exit(1); // eslint-disable-line no-process-exit
});
