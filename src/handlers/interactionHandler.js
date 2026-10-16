const { SlashCommandBuilder } = require('discord.js');

const slashCommands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency.'),
];

async function registerInteractions(client, logger) {
  if (!client?.application?.commands) return;
  try {
    await client.application.commands.set(slashCommands.map((cmd) => cmd.toJSON()));
    logger?.info?.(`Registered ${slashCommands.length} slash command(s): /${slashCommands.map((c) => c.name).join(', /')}`);
  } catch (error) {
    logger?.error?.('Failed to register slash commands:', error);
  }
}

async function handleInteraction(interaction, { logger } = {}) {
  if (!interaction.isChatInputCommand()) return false;

  if (interaction.commandName === 'ping') {
    const latency = Math.max(0, Date.now() - interaction.createdTimestamp);
    const wsPing = Math.round(interaction.client.ws.ping);
    await interaction.reply({ content: `🏓 Pong! Client ${latency}ms | WS ${wsPing}ms`, ephemeral: true });
    return true;
  }

  logger?.debug?.(`Unhandled slash command: ${interaction.commandName}`);
  return false;
}

module.exports = {
  registerInteractions,
  handleInteraction,
};
