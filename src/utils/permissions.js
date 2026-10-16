const { DEFAULTS, getSettings } = require('./guildSettings');
const { config } = require('../config');

function hasAdminPower(member) {
  if (!member) return false;
  return member.permissions?.has('Administrator') || member.permissions?.has('ManageGuild');
}

function isCommander(member, guildId) {
  if (!member) return false;
  if (hasAdminPower(member)) return true;

  const settings = typeof guildId === 'string' ? getSettings(guildId) : (guildId || DEFAULTS);
  const roleName = settings.commanderRole || config.defaultCommanderRole;
  if (!roleName) return false;
  return member.roles?.cache?.some((role) => role.name.toLowerCase() === roleName.toLowerCase());
}

function requireCommander(member, guildId) {
  if (!isCommander(member, guildId)) {
    const error = new Error('Commander permissions required');
    error.code = 'ERR_NOT_COMMANDER';
    throw error;
  }
}

module.exports = {
  hasAdminPower,
  isCommander,
  requireCommander,
};
