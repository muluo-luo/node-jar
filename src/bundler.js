const ncc = require('@vercel/ncc');
const fs = require('fs');
const path = require('path');
const { info, success, warn } = require('./utils');

async function bundle(entryPath, options = {}) {
  const {
    externals = [],
    minify = true,
    cwd = process.cwd(),
  } = options;

  info(`打包入口: ${path.relative(cwd, entryPath)}`);

  if (externals.length) {
    info(`外部依赖: ${externals.join(', ')}`);
  }

  const nccOptions = {
    minify,
    sourceMap: false,
    sourceMapRegister: false,
    watch: false,
    quiet: true,
    v8cache: false,
    assetBuilds: false,
    externals: externals.length ? externalsToRegex(externals) : undefined,
    filterAssetBase: cwd,
  };

  let result;
  try {
    result = await ncc(entryPath, nccOptions);
  } catch (err) {
    if (err.message && err.message.includes('Module parse failed')) {
      warn(`模块解析失败: ${err.message.split('\n')[0]}`);
      throw new Error(`打包失败: ${err.message}`);
    }
    throw err;
  }

  const code = result.code;
  const assets = result.assets || {};

  const originalSize = code.length;
  success(`打包完成: ${originalSize.toLocaleString()} 字符, ${Object.keys(assets).length} 个静态资源`);

  return { code, assets };
}

function externalsToRegex(externals) {
  const escaped = externals.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^(${escaped.join('|')})(?:/.*)?$`);
}

module.exports = { bundle };
