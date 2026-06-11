const fs = require('fs');
const path = require('path');
const { info, warn } = require('./utils');

function detectProject(cwd = process.cwd()) {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { type: 'unknown', hasTS: false, hasESM: false, framework: null };
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  const hasTS = !!(allDeps.typescript || allDeps['@types/node'] || fs.existsSync(path.join(cwd, 'tsconfig.json')));

  const hasESM = pkg.type === 'module';

  let framework = null;
  if (allDeps['@nestjs/core']) framework = 'nestjs';
  else if (allDeps.express) framework = 'express';
  else if (allDeps.koa) framework = 'koa';
  else if (allDeps.fastify) framework = 'fastify';
  else if (allDeps['@hapi/hapi']) framework = 'hapi';
  else if (allDeps.egg) framework = 'egg';

  return { type: hasTS ? 'typescript' : 'javascript', hasTS, hasESM, framework, pkg };
}

function detectNativeModules(cwd = process.cwd()) {
  const knownNative = ['bcrypt', 'sharp', 'sqlite3', 'better-sqlite3', 'node-gyp', 'canvas', 'node-pty', 'cpu-features'];
  const result = [];

  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return result;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const name of knownNative) {
    if (allDeps[name]) result.push(name);
  }

  return result;
}

module.exports = { detectProject, detectNativeModules };
