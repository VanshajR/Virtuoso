const levels = ['error', 'warn', 'info', 'debug'];

function createLogger(level = 'info') {
  const currentIdx = levels.indexOf(level);

  function shouldLog(targetLevel) {
    return levels.indexOf(targetLevel) <= currentIdx;
  }

  function formatMessage(targetLevel, args) {
    const timestamp = new Date().toISOString();
    return [`[${timestamp}] [${targetLevel.toUpperCase()}]`, ...args];
  }

  return {
    info: (...args) => shouldLog('info') && console.log(...formatMessage('info', args)),
    warn: (...args) => shouldLog('warn') && console.warn(...formatMessage('warn', args)),
    error: (...args) => shouldLog('error') && console.error(...formatMessage('error', args)),
    debug: (...args) => shouldLog('debug') && console.debug(...formatMessage('debug', args)),
  };
}

module.exports = createLogger;
