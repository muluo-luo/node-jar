const chalk = require('chalk');

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
let currentLevel = LOG_LEVELS.info;

function setLogLevel(level) {
  if (typeof level === 'string') currentLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info;
  else currentLevel = level;
}

function debug(...args) { if (currentLevel <= LOG_LEVELS.debug) console.log(chalk.gray('[DEBUG]'), ...args); }
function info(...args) { if (currentLevel <= LOG_LEVELS.info) console.log(chalk.cyan('[node-jar]'), ...args); }
function success(...args) { if (currentLevel <= LOG_LEVELS.info) console.log(chalk.green('[node-jar]'), ...args); }
function warn(...args) { if (currentLevel <= LOG_LEVELS.warn) console.warn(chalk.yellow('[WARN]'), ...args); }
function error(...args) { if (currentLevel <= LOG_LEVELS.error) console.error(chalk.red('[ERROR]'), ...args); }

function walkDir(dir, callback, baseDir = dir) {
  const fs = require('fs');
  const path = require('path');
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath, callback, baseDir);
    } else {
      const relPath = path.relative(baseDir, fullPath);
      callback(relPath, fs.readFileSync(fullPath));
    }
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

module.exports = { setLogLevel, debug, info, success, warn, error, walkDir, formatSize };
