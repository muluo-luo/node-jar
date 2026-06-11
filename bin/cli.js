#!/usr/bin/env node
const { program } = require('commander');
const path = require('path');

const pkg = require('../package.json');

program
  .name('node-jar')
  .description('Bundle Node.js apps into a single deployable file — like Java JAR but for Node')
  .version(pkg.version);

program
  .command('build')
  .description('Build a deployable bundle from current project')
  .option('-e, --entry <path>', 'Entry file (default: auto-detect from package.json)')
  .option('-o, --output <path>', 'Output file path (default: dist/app.bundle.js)')
  .option('--tsconfig <path>', 'TypeScript config file path')
  .option('--obfuscate', 'Enable code obfuscation via javascript-obfuscator')
  .option('--encrypt', 'Enable AES-256-CBC bundle encryption')
  .option('--encrypt-key <type>', 'Key source: env (APP_SECRET), file:<path>, or custom string', 'env')
  .option('--static <dirs...>', 'Additional static directories to embed')
  .option('--externals <pkgs...>', 'Packages to keep as external require()')
  .option('--no-minify', 'Disable minification (for debugging)')
  .option('-c, --config <path>', 'Path to node-jar config file')
  .option('-q, --quiet', 'Suppress non-error output')
  .option('--cwd <path>', 'Working directory (default: current directory)')
  .action(async (opts) => {
    const { build } = require('../src/index');
    const { setLogLevel } = require('../src/utils');

    if (opts.quiet) setLogLevel('error');

    const cwd = opts.cwd ? path.resolve(opts.cwd) : process.cwd();

    // If --config specified, load and merge
    let fileConfig = {};
    if (opts.config) {
      const configPath = path.resolve(cwd, opts.config);
      try {
        fileConfig = require(configPath);
      } catch (e) {
        console.error(`Failed to load config: ${configPath}`);
        process.exit(1);
      }
    }

    const buildOpts = {
      ...fileConfig,
      cwd,
      entry: opts.entry || fileConfig.entry,
      output: opts.output || fileConfig.output,
      obfuscate: opts.obfuscate || fileConfig.obfuscate,
      encrypt: opts.encrypt || fileConfig.encrypt,
      encryptKey: opts.encryptKey !== 'env' ? opts.encryptKey : (fileConfig.encryptKey || 'env'),
      static: opts.static || fileConfig.static,
      externals: opts.externals || fileConfig.externals,
      minify: opts.minify !== false && fileConfig.minify !== false,
    };

    try {
      await build(buildOpts);
    } catch (e) {
      console.error('Build failed:', e.message);
      if (!opts.quiet) console.error(e.stack);
      process.exit(1);
    }
  });

program.parse();
