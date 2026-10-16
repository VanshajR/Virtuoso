const respond = require('../utils/respond');
const { requireCommander } = require('../utils/permissions');
const { DEFAULTS, resetSettings } = require('../utils/guildSettings');

const ON_VALUES = ['true', '1', 'yes', 'on', 'enable', 'enabled'];
const OFF_VALUES = ['false', '0', 'no', 'off', 'disable', 'disabled'];

const SCHEMA = {
  prefersc: { key: 'preferSoundCloud', type: 'boolean', label: 'Prefer SoundCloud when searching' },
  votes: { key: 'voteSkipEnabled', type: 'boolean', label: 'Enable vote-based skip' },
  voteratio: { key: 'voteSkipRatio', type: 'number', min: 0.1, max: 1, label: 'Vote skip ratio' },
  commanders: { key: 'commanderRole', type: 'string', label: 'Commander role name' },
  stoplimit: { key: 'stopRestricted', type: 'boolean', label: 'Restrict stop to commanders/solo' },
};

function formatSettings(settings) {
  const merged = { ...DEFAULTS, ...(settings || {}) };
  return [
    `• Prefer SoundCloud: **${merged.preferSoundCloud ? 'On' : 'Off'}**`,
    `• Vote skip: **${merged.voteSkipEnabled ? 'On' : 'Off'}** (ratio ${merged.voteSkipRatio})`,
    `• Commander role: **${merged.commanderRole || 'Not set'}**`,
    `• Stop command restricted: **${merged.stopRestricted ? 'Yes' : 'No'}**`,
  ].join('\n');
}

function parseValue(schema, input) {
  if (schema.type === 'boolean') {
    const lower = input.toLowerCase();
    if (ON_VALUES.includes(lower)) return true;
    if (OFF_VALUES.includes(lower)) return false;
    return null;
  }
  if (schema.type === 'number') {
    const value = Number(input);
    if (Number.isNaN(value)) return null;
    const clamped = Math.min(schema.max, Math.max(schema.min, value));
    return clamped;
  }
  if (schema.type === 'string') {
    return input.trim() || null;
  }
  return null;
}

module.exports = {
  name: 'settings',
  description: 'View or update Virtuoso per-server settings.',
  usage: '!settings [view|set <option> <value>|reset <option|all>]',
  async execute(message, args, context) {
    try {
      requireCommander(message.member, message.guild.id);
    } catch (error) {
      await message.reply(respond.error({
        title: 'Commander permissions required',
        description: 'Only admins or commander role members can edit settings.',
        user: message.author.tag,
      }));
      return;
    }

    const sub = (args[0] || 'view').toLowerCase();
    const settings = context.guildSettings;

    if (sub === 'view') {
      await message.reply(respond.success({
        title: 'Current Virtuoso settings',
        description: formatSettings(settings),
        user: message.author.tag,
      }));
      return;
    }

    if (sub === 'reset') {
      const target = (args[1] || 'all').toLowerCase();
      if (target === 'all') {
        resetSettings(message.guild.id);
        const refreshed = context.updateGuildSettings({ ...DEFAULTS });
        await message.reply(respond.success({
          title: 'Settings reset',
          description: 'All options restored to defaults.',
          user: message.author.tag,
        }));
        context.guildSettings = refreshed;
        return;
      }
      const schema = SCHEMA[target];
      if (!schema) {
        await message.reply(respond.error({
          title: 'Unknown option',
          description: 'Reset supports `all` or any option you can `set`.',
          user: message.author.tag,
        }));
        return;
      }
      const patched = context.updateGuildSettings({ [schema.key]: DEFAULTS[schema.key] });
      await message.reply(respond.success({
        title: 'Option reset',
        description: `${schema.label} restored to default value.`,
        user: message.author.tag,
      }));
      context.guildSettings = patched;
      return;
    }

    if (sub === 'set') {
      const option = (args[1] || '').toLowerCase();
      const schema = SCHEMA[option];
      if (!schema) {
        await message.reply(respond.error({
          title: 'Unknown option',
          description: 'Valid options: preferSC, votes, voteRatio, commanders, stopLimit.',
          user: message.author.tag,
        }));
        return;
      }
      const valueInput = args.slice(2).join(' ');
      if (!valueInput) {
        await message.reply(respond.error({
          title: 'Missing value',
          description: 'Provide the value you would like to set.',
          user: message.author.tag,
        }));
        return;
      }
      const parsed = parseValue(schema, valueInput);
      if (parsed === null || parsed === undefined) {
        await message.reply(respond.error({
          title: 'Invalid value',
          description: schema.type === 'boolean' ? 'Use on/off, true/false, yes/no.' : 'Provide a valid value.',
          user: message.author.tag,
        }));
        return;
      }
      const updated = context.updateGuildSettings({ [schema.key]: parsed });
      await message.reply(respond.success({
        title: 'Settings updated',
        description: formatSettings(updated),
        user: message.author.tag,
      }));
      context.guildSettings = updated;
      return;
    }

    await message.reply(respond.error({
      title: 'Unknown subcommand',
      description: 'Use `view`, `set`, or `reset`.',
      user: message.author.tag,
    }));
  },
};
