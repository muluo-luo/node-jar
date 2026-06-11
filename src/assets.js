const path = require('path');
const fs = require('fs');
const { info, success, walkDir } = require('./utils');

function collectAssets(nccAssets, staticDirs = [], cwd = process.cwd()) {
  const virtualFS = {};

  // 1. Collect ncc-discovered assets
  for (const [filename, asset] of Object.entries(nccAssets)) {
    const content = asset.source;
    if (Buffer.isBuffer(content)) {
      virtualFS[filename] = content.toString('base64');
    } else if (typeof content === 'string') {
      virtualFS[filename] = Buffer.from(content).toString('base64');
    }
  }

  // 2. Collect static directories
  for (const dir of staticDirs) {
    const fullPath = path.resolve(cwd, dir);
    if (!fs.existsSync(fullPath)) {
      info(`  跳过不存在的目录: ${dir}`);
      continue;
    }
    let count = 0;
    walkDir(fullPath, (relPath, content) => {
      const key = relPath.replace(/\\/g, '/');
      virtualFS[key] = content.toString('base64');
      count++;
    }, fullPath);
    info(`  嵌入资源: ${dir}/ (${count} 个文件)`);
  }

  // 3. Collect .env files and known config files
  for (const pattern of ['.env', '.env.production', '.env.local']) {
    const fp = path.join(cwd, pattern);
    if (fs.existsSync(fp)) {
      virtualFS[pattern] = fs.readFileSync(fp).toString('base64');
      info(`  嵌入配置: ${pattern}`);
    }
  }

  return virtualFS;
}

function injectVirtualFS(code, virtualFS) {
  const vfsJson = JSON.stringify(Object.fromEntries(
    Object.entries(virtualFS)
  ));

  const bootstrap = `
(function() {
  var __nodeJarVFS__ = new Map(Object.entries(${vfsJson}));
  var __origFs__ = {};

  // Patch fs module for virtual FS
  var fsModule = require('fs');
  var pathModule = require('path');

  function normalizePath(p) {
    if (p == null) return p;
    if (typeof p !== 'string') return p;
    if (p instanceof URL) return p;
    return pathModule.normalize(p).replace(/\\\\/g, '/');
  }

  function vfsLookup(filePath) {
    var key = normalizePath(filePath);
    for (var _it = __nodeJarVFS__.entries(), _n = _it.next(); !_n.done; _n = _it.next()) {
      var vpath = _n.value[0];
      var vdata = _n.value[1];
      if (key.endsWith(vpath) || key === vpath) {
        return vdata;
      }
    }
    return null;
  }

  __origFs__.readFileSync = fsModule.readFileSync;
  fsModule.readFileSync = function(filePath, options) {
    var data = vfsLookup(filePath);
    if (data !== null) {
      var buf = Buffer.from(data, 'base64');
      return (options && options.encoding) ? buf.toString(options.encoding) : buf;
    }
    return __origFs__.readFileSync.call(fsModule, filePath, options);
  };

  __origFs__.existsSync = fsModule.existsSync;
  fsModule.existsSync = function(filePath) {
    if (vfsLookup(filePath) !== null) return true;
    return __origFs__.existsSync.call(fsModule, filePath);
  };

  __origFs__.statSync = fsModule.statSync;
  fsModule.statSync = function(filePath) {
    var data = vfsLookup(filePath);
    if (data !== null) {
      return {
        isFile: function() { return true; },
        isDirectory: function() { return false; },
        isBlockDevice: function() { return false; },
        isCharacterDevice: function() { return false; },
        isFIFO: function() { return false; },
        isSocket: function() { return false; },
        isSymbolicLink: function() { return false; },
        size: Buffer.byteLength(data, 'base64'),
        mtime: new Date(),
        atime: new Date(),
        ctime: new Date(),
        birthtime: new Date(),
        dev: 0,
        ino: 0,
        mode: 33188,
        nlink: 1,
        uid: 0,
        gid: 0,
        rdev: 0,
        blksize: 4096,
        blocks: Math.ceil(Buffer.byteLength(data, 'base64') / 512)
      };
    }
    return __origFs__.statSync.call(fsModule, filePath);
  };

  __origFs__.readdirSync = fsModule.readdirSync;
  fsModule.readdirSync = function(dirPath) {
    var result = [];
    try { result = __origFs__.readdirSync.call(fsModule, dirPath); } catch(e) {}
    var dirKey = normalizePath(dirPath);
    var seen = new Set(result);
    for (var _it2 = __nodeJarVFS__.keys(), _n2 = _it2.next(); !_n2.done; _n2 = _it2.next()) {
      var vpath = _n2.value;
      var vdir = pathModule.dirname(vpath);
      if (vdir === dirKey || dirKey.endsWith('/') && vdir === dirKey.slice(0, -1)) {
        var fname = pathModule.basename(vpath);
        if (!seen.has(fname)) { result.push(fname); seen.add(fname); }
      }
    }
    return result;
  };
})();\n`;

  return bootstrap + code;
}

module.exports = { collectAssets, injectVirtualFS };
