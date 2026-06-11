const path = require('path');
const fs = require('fs');
const { build: esbuild } = require('esbuild');
const { info, success, warn } = require('./utils');

async function compileTypeScript(entryPath, cwd = process.cwd()) {
  const tsconfigPath = path.join(cwd, 'tsconfig.json');
  let tsconfig = {};

  if (fs.existsSync(tsconfigPath)) {
    try {
      const raw = fs.readFileSync(tsconfigPath, 'utf8');
      tsconfig = JSON.parse(raw);
      info(`读取 tsconfig: ${path.relative(cwd, tsconfigPath)}`);
    } catch (e) {
      warn(`tsconfig.json 解析失败: ${e.message}，使用默认配置`);
    }
  }

  const compilerOptions = tsconfig.compilerOptions || {};
  const outDir = compilerOptions.outDir || 'dist-ts';
  const outPath = path.join(cwd, outDir, 'app.compiled.js');

  const define = {};
  if (compilerOptions.paths) {
    for (const [alias, targets] of Object.entries(compilerOptions.paths)) {
      const key = alias.replace(/\/\*$/, '');
      const value = targets[0]?.replace(/\/\*$/, '');
      if (key && value) {
        const resolved = path.resolve(cwd, compilerOptions.baseUrl || '.', value);
        define[key] = JSON.stringify(resolved);
      }
    }
  }

  info('编译 TypeScript...');
  const result = await esbuild({
    entryPoints: [entryPath],
    bundle: false,
    outfile: outPath,
    platform: 'node',
    target: 'node16',
    format: 'cjs',
    tsconfig: fs.existsSync(tsconfigPath) ? tsconfigPath : undefined,
    sourcemap: false,
    minify: false,
    keepNames: true,
    treeShaking: false,
    external: ['@nestjs/microservices', '@nestjs/websockets/socket-module', 'cache-manager', 'class-transformer', 'class-validator'],
    logLevel: 'silent',
  });

  if (result.warnings.length) {
    for (const w of result.warnings) warn(`TS编译警告: ${w.text}`);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  success(`TypeScript 编译完成: ${path.relative(cwd, outPath)}`);
  return outPath;
}

module.exports = { compileTypeScript };
