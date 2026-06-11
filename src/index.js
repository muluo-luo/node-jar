const path = require('path');
const fs = require('fs');
const { loadConfig, resolveEntry, resolveOutput, readPackageJson } = require('./config');
const { detectProject } = require('./detector');
const { compileTypeScript } = require('./typescript');
const { bundle } = require('./bundler');
const { collectAssets, injectVirtualFS } = require('./assets');
const { obfuscate } = require('./obfuscator');
const { encryptBundle, wrapWithDecryptor } = require('./encryptor');
const { detectNativeInTree, writeSidecar } = require('./native-modules');
const { info, success, warn, error, formatSize } = require('./utils');

async function build(options = {}) {
  const cwd = options.cwd || process.cwd();

  // 1. Load config
  const fileConfig = loadConfig(cwd);
  const merged = { ...fileConfig, ...options };
  const pkg = readPackageJson(cwd);

  if (!pkg) {
    error('未找到 package.json。请在 Node.js 项目根目录运行。');
    process.exit(1);
  }

  // 2. Detect project type
  const project = detectProject(cwd);
  info(`项目类型: ${project.type}${project.framework ? ` (${project.framework})` : ''}${project.hasESM ? ' [ESM]' : ' [CJS]'}`);
  if (project.framework) {
    info(`检测到框架: ${project.framework}`);
  }

  // 3. Resolve entry point
  const entry = resolveEntry(merged.entry, pkg, cwd);
  const output = resolveOutput(merged.output, cwd);

  info(`入口文件: ${path.relative(cwd, entry)}`);
  info(`输出路径: ${path.relative(cwd, output)}`);

  // 4. Detect native modules
  const nativeModules = detectNativeInTree(cwd);
  const externals = [...(merged.externals || [])];

  if (nativeModules.length) {
    for (const mod of nativeModules) {
      const name = mod.name.split(' ')[0];
      if (!externals.includes(name)) externals.push(name);
    }
  }

  // 5. Get static directories from config
  let staticDirs = merged.static || [];
  if (merged.static === undefined && fileConfig.static === undefined) {
    const guesses = ['public', 'static', 'assets', 'views', 'templates', 'dist/client', 'build'];
    for (const dir of guesses) {
      if (fs.existsSync(path.join(cwd, dir))) staticDirs.push(dir);
    }
  }

  // Stage 0: Compile TypeScript if needed
  let jsEntry = entry;
  const tsoutDir = path.join(cwd, 'dist-ts');
  if (project.hasTS && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
    jsEntry = await compileTypeScript(entry, cwd);
  }

  // Stage 1: Bundle with ncc
  const { code: bundled, assets: nccAssets } = await bundle(jsEntry, {
    externals,
    minify: merged.minify !== false,
    cwd,
  });

  // Stage 2: Embed assets with virtual FS
  const allStaticDirs = Array.isArray(staticDirs) ? staticDirs : [];
  const vfsData = collectAssets(nccAssets, allStaticDirs, cwd);
  let finalCode = injectVirtualFS(bundled, vfsData);

  // Stage 3a: Obfuscation (optional)
  if (merged.obfuscate) {
    finalCode = obfuscate(finalCode, merged.obfuscateOptions || {});
  }

  // Stage 3b: Encryption (optional)
  if (merged.encrypt) {
    const encryptKey = merged.encryptKey || 'env';
    const { encrypted, iv, keySource } = encryptBundle(finalCode, encryptKey);
    finalCode = wrapWithDecryptor(encrypted, iv, keySource);
  }

  // Stage 4: Write output
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, finalCode, 'utf8');

  const stats = {
    originalSize: bundled.length,
    finalSize: finalCode.length,
    assetCount: Object.keys(vfsData).length,
    nativeModules: nativeModules.length ? nativeModules.map(m => m.name) : [],
    obfuscated: !!merged.obfuscate,
    encrypted: !!merged.encrypt,
    framework: project.framework,
    hasTS: project.hasTS,
  };

  // Sidecar mode for native modules
  if (nativeModules.length) {
    writeSidecar(nativeModules, output, pkg);
  }

  // Report
  success('========================================');
  success('  构建完成!');
  success('========================================');
  info(`  输出文件: ${path.relative(cwd, output)}`);
  info(`  文件大小: ${formatSize(finalCode.length)}`);
  info(`  嵌入资源: ${stats.assetCount} 个文件`);
  if (stats.obfuscated) info(`  代码混淆: 已启用`);
  if (stats.encrypted) info(`  代码加密: 已启用`);
  if (stats.nativeModules.length) {
    info(`  原生模块: ${stats.nativeModules.join(', ')} (sidecar 模式)`);
  }
  info('');
  info('  部署命令:');
  if (nativeModules.length) {
    info(`    cd ${path.relative(cwd, path.dirname(output))} && npm install --production && node ${path.basename(output)}`);
  } else {
    info(`    node ${path.relative(cwd, output)}`);
  }

  return { outputPath: output, stats, code: finalCode };
}

module.exports = { build };
