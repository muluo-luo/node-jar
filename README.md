<p align="center">
  <img src="logo.png" alt="node-jar logo — capybara" width="160">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen" alt="Node version">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/version-0.1.0-orange" alt="Version">
</p>

<h1 align="center">node-jar</h1>

<p align="center"><strong>Bundle any Node.js backend app into a single deployable file.<br>Express, NestJS, Koa, Fastify — doesn't matter. Treat it like a JAR.</strong></p>

---

## Why node-jar?

Java has JAR. Python has wheels. Node.js? **npm install on production.**

The typical Node.js deployment is wasteful:

```
git pull → npm install (5 minutes, 500MB+) → npm run build → pm2 restart
```

Every server downloads hundreds of megabytes of dependencies — even though nothing changed.

With **node-jar**, you build once, ship a single file:

```
npx node-jar build → scp dist/app.bundle.js → node app.bundle.js
```

| | Traditional | node-jar |
|---|---|---|
| **Deploy time** | 5–10 minutes | **10 seconds** |
| **Server disk** | 200–500 MB | **2–20 MB** |
| **Network** | Downloads all deps | **One file upload** |
| **Dependency drift** | Possible | **Impossible** (locked at build) |
| **Rollback** | git checkout + npm install | **Swap one file** |
| **Server Node version** | Must match | **Any ≥16** |
| **Framework** | Whatever you use | **All supported** |

> **"But the server still needs Node.js."** — Yes. Just like Java needs a JVM and Python needs a Python interpreter. Installing Node.js is a one-time setup. What you eliminate is the *per-deploy* cost of `npm install`.

## Quick Start

```bash
# 1. Install as a dev dependency
npm install --save-dev node-jar

# 2. Build your project (auto-detects everything)
npx node-jar build

# 3. Deploy the output
node dist/app.bundle.js
```

That's it. No config needed. `node-jar` reads your `package.json`, finds your entry point, detects TypeScript, bundles everything, and produces a single file.

## Framework Support

**One tool. Any framework.**

`node-jar` injects a virtual filesystem shim that intercepts `fs.readFileSync`, `fs.statSync`, `fs.existsSync`, and `fs.readdirSync` — the four functions every Node.js framework's static file middleware relies on. This means your framework works without modification.

| Framework | Static Files | Templates | TypeScript | ORM |
|---|---|---|---|---|
| **Express** | `express.static` → VFS | EJS / Pug / Handlebars | Optional | Pure JS ORMs |
| **NestJS** | `@nestjs/serve-static` → VFS | — | esbuild compilation | TypeORM / Prisma |
| **Koa** | `koa-static` → VFS | — | Optional | Pure JS ORMs |
| **Fastify** | `@fastify/static` → VFS | — | Optional | Pure JS ORMs |
| **Hapi** | `@hapi/inert` → VFS | — | Optional | Pure JS ORMs |
| **Egg.js** | `egg-static` → VFS | Nunjucks / EJS | Optional | Pure JS ORMs |

**The principle**: Static file middleware in every Node.js framework ultimately calls `fs.readFileSync`. Patch that, and every framework works out of the box.

### Database Drivers

Pure JavaScript drivers bundle directly. No native addons needed:

- **MySQL** — `mysql2` (pure JS mode)
- **PostgreSQL** — `pg` (pure JS)
- **Redis** — `ioredis` (pure JS)
- **MongoDB** — `mongodb` (uses `mongodb-client-encryption` as optional native)

For native C/C++ modules (`bcrypt`, `sharp`, `sqlite3`), see [Native Modules](#native-modules).

## CLI Usage

```bash
# Zero-config: auto-detect everything
npx node-jar build

# Full control
npx node-jar build \
  --entry src/main.ts \
  --output dist/app.bundle.js \
  --tsconfig tsconfig.build.json \
  --obfuscate \
  --encrypt \
  --encrypt-key env \
  --static public,templates \
  --externals sharp,bcrypt \
  --no-minify
```

### Options

| Option | Description | Default |
|---|---|---|
| `-e, --entry <path>` | Entry file | Auto-detected from `package.json` |
| `-o, --output <path>` | Output bundle path | `dist/app.bundle.js` |
| `--tsconfig <path>` | TypeScript config | Auto-detected |
| `--obfuscate` | Enable code obfuscation | `false` |
| `--encrypt` | Enable AES-256-CBC encryption | `false` |
| `--encrypt-key <type>` | Key source: `env`, `file:<path>`, or custom | `env` |
| `--static <dirs...>` | Extra static directories to embed | `public,static,assets` (if exist) |
| `--externals <pkgs...>` | Packages to keep as `require()` | `[]` |
| `--no-minify` | Disable minification (debugging) | `minify: true` |
| `-c, --config <path>` | Path to config file | Auto-detected |
| `-q, --quiet` | Suppress non-error output | `false` |

## JS API

```js
const { build } = require('node-jar');

// Zero-config
await build();

// Full control
const result = await build({
  entry: 'src/main.ts',
  output: 'dist/app.bundle.js',
  obfuscate: true,
  encrypt: true,
  static: ['public', 'templates'],
  externals: ['sharp'],
});

console.log(result.stats);
// {
//   originalSize: 234567,
//   finalSize: 187654,
//   assetCount: 12,
//   nativeModules: [],
//   obfuscated: true,
//   encrypted: true,
//   framework: 'nestjs',
//   hasTS: true
// }
```

## Configuration File

Create `node-jar.config.js` (or `.json`) in your project root:

```js
module.exports = {
  entry: 'src/main.ts',
  output: 'dist/app.bundle.js',
  obfuscate: true,
  encrypt: false,
  static: ['public', 'templates'],
  externals: ['sharp'],
};
```

Config files are auto-loaded. CLI flags override config values.

## How It Works

```
                    [0. Detect & Pre-process]
                              │
         ┌────────────────────┼────────────────────┐
         │ TypeScript?        │ JavaScript?         │
         │ esbuild → CJS      │ use as-is           │
         └────────────────────┴────────────────────┘
                              │
                              ▼
                    [1. NCC Bundle]
                   All deps + entry → single JS file
                              │
                              ▼
                    [2. Asset Embedding]
                  Static files / configs / templates
                        → Base64 → Virtual FS Shim
                              │
                              ▼
                    [3. Code Protection]
                  Layer A: Obfuscation (optional)
                  Layer B: AES-256-CBC (optional)
                              │
                              ▼
                    [4. Bootstrap]
                  [VFS Shim] → [Decrypt?] → [App]
                              │
                              ▼
                       app.bundle.js
```

### Stage 0 — Detection

Scans your project and auto-configures:
- TypeScript presence → enables esbuild compilation
- `tsconfig.json` → reads compiler options & path aliases
- `"type": "module"` → detects ESM
- Framework markers (`@nestjs/core`, `express`, `koa`, etc.) → logged for visibility

### Stage 1 — Bundling (`@vercel/ncc`)

Compiles your entry file + the entire `node_modules` dependency tree into a single self-contained JavaScript file:
- Tree-shaking: removes unused code
- Scope hoisting: merges module scopes
- Minification: reduces output size

### Stage 2 — Virtual Filesystem

Collects non-JS resources and injects an `fs` monkey-patch:

- **Static files**: `public/`, `static/`, `assets/`, `dist/client/`, `build/`
- **Config files**: `.env`, `.env.production`, `config/*.json`, `ormconfig.json`
- **Templates**: `views/*.hbs`, `views/*.ejs`, `templates/*`
- **Schema files**: `*.proto`, `*.graphql`, `prisma/schema.prisma`

All embedded in the bundle as Base64. The virtual FS shim intercepts `readFileSync`, `statSync`, `existsSync`, and `readdirSync` so frameworks read from memory instead of disk — no code changes needed.

### Stage 3 — Code Protection (Optional)

| Layer | Trigger | Protection Level | Performance |
|---|---|---|---|
| **A: Obfuscation** | `--obfuscate` | Control flow flattening, string encoding, dead code injection | Build +30s; runtime +5~15% |
| **B: Encryption** | `--encrypt` | AES-256-CBC whole-bundle encryption | Startup +50~200ms (one-time) |

Layers stack. Use both for maximum protection.

## Native Modules

C/C++ addons (`.node` files) cannot be bundled into pure JavaScript. `node-jar` detects them automatically and switches to **sidecar mode**:

```
dist/
├── app.bundle.js        # Main app (pure JS)
└── package.json         # Sidecar — only native deps (3–5 lines)
```

Deployment with native modules:

```bash
# Upload the dist/ directory
scp -r dist/ server:/opt/app/

# On the server — install only the native bits (seconds, not minutes)
cd /opt/app && npm install --production

# Run
node app.bundle.js
```

### Prisma

Prisma's Query Engine is a native binary. `node-jar` detects `@prisma/client` and automatically handles it via sidecar mode.

| Scenario | Package | Handling |
|---|---|---|
| Pure JS | `mysql2`, `pg`, `ioredis`, `redis` | Bundled directly |
| Optional native | `mongodb` (kerberos), `mysql2` (native) | Pure JS path, bundled |
| Native required | `bcrypt`, `sharp`, `sqlite3` | Sidecar mode |
| ORM-wrapped native | TypeORM + `sqlite3`, Prisma engine | Detected → sidecar |

## Real-World Deployment

**Before** (traditional):
```
$ ssh server
$ cd /opt/app && git pull
$ npm install        # 5 minutes, 500MB
$ npm run build      # 2 minutes
$ pm2 restart myapp
```

**After** (node-jar):
```
$ npx node-jar build --obfuscate
$ scp dist/app.bundle.js server:/opt/app/
$ ssh server "pm2 restart myapp"
```

10 seconds. One file. No surprises.

## Requirements

- **Building**: Node.js ≥ 16.0.0, with `npm install` (one-time)
- **Running**: Node.js ≥ 16.0.0 on the target server
- **Optional**: `javascript-obfuscator` (`npm install -D javascript-obfuscator`) for code obfuscation

## License

MIT © 慕落

---

<p align="center"><em>"Ship your Node.js app like a JAR. Because 500MB of node_modules belongs on your CI server, not your production box."</em></p>
