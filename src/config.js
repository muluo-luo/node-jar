const path = require('path');
const fs = require('fs');
const { info } = require('./utils');

function loadConfig(cwd = process.cwd()) {
  const configFiles = [
    'nar.config.js',
    'nar.config.cjs',
    'nar.config.json',
  ];

  for (const name of configFiles) {
    const configPath = path.join(cwd, name);
    if (fs.existsSync(configPath)) {
      info(`加载配置: ${name}`);
      const config = name.endsWith('.json')
        ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
        : require(configPath);
      return config;
    }
  }

  return {};
}

function resolveEntry(configEntry, pkg, cwd = process.cwd()) {
  if (configEntry) return path.resolve(cwd, configEntry);

  if (pkg && pkg.main) return path.resolve(cwd, pkg.main);

  const guesses = ['src/main.ts', 'src/main.js', 'src/app.ts', 'src/app.js', 'src/index.ts', 'src/index.js', 'index.ts', 'index.js'];
  for (const g of guesses) {
    const p = path.join(cwd, g);
    if (fs.existsSync(p)) return p;
  }

  throw new Error('未找到入口文件。请通过 --entry 指定，或在 package.json 中配置 main 字段。');
}

function resolveOutput(configOutput, cwd = process.cwd()) {
  return path.resolve(cwd, configOutput || 'dist/app.bundle.js');
}

function readPackageJson(cwd = process.cwd()) {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
}

module.exports = { loadConfig, resolveEntry, resolveOutput, readPackageJson };
