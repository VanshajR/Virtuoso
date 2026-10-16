const fs = require('fs');
const path = require('path');

function loadCommands(logger) {
  const commands = new Map();
  const commandsDir = path.resolve(__dirname, '..', 'commands');
  const files = fs.readdirSync(commandsDir).filter((file) => file.endsWith('.js'));

  for (const file of files) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const command = require(path.join(commandsDir, file));
    if (!command?.name || typeof command.execute !== 'function') {
      logger?.warn?.(`Skipping command file ${file} — missing name or execute()`);
      continue;
    }
    commands.set(command.name, command);
    if (Array.isArray(command.aliases)) {
      for (const alias of command.aliases) {
        commands.set(alias, command);
      }
    }
    logger?.debug?.(`Loaded command ${command.name} from ${file}`);
  }

  logger?.info?.(`Loaded ${files.length} command files (${commands.size} entries including aliases).`);
  return commands;
}

async function runCommand(commands, name, message, args, context) {
  const command = commands.get(name);
  if (!command) return false;
  await command.execute(message, args, context);
  return true;
}

module.exports = {
  loadCommands,
  runCommand,
};
