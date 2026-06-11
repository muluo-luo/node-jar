const crypto = require('crypto');
const { info, success } = require('./utils');

function encryptBundle(code, keySource = 'env') {
  const secret = resolveSecret(keySource);
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(code, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return {
    encrypted,
    iv: iv.toString('base64'),
    keySource,
  };
}

function wrapWithDecryptor(encrypted, iv, keySource) {
  const secretResolver = keySource === 'env'
    ? `process.env.APP_SECRET || process.env.NODE_JAR_SECRET || 'node-jar-default-secret'`
    : keySource === 'machine'
      ? `require('os').hostname() + require('os').platform()`
      : JSON.stringify(keySource);

  return `// node-jar encrypted bundle
const crypto = require('crypto');
const Module = require('module');

(function() {
  var SECRET = String(${secretResolver});
  var KEY = crypto.createHash('sha256').update(SECRET).digest();
  var IV = Buffer.from('${iv}', 'base64');
  var ENCRYPTED = '${encrypted}';

  try {
    var decipher = crypto.createDecipheriv('aes-256-cbc', KEY, IV);
    var decrypted = decipher.update(ENCRYPTED, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    // Execute in module context so require/__dirname work correctly
    var m = new Module('', module);
    m.paths = Module._nodeModulePaths(process.cwd());
    m._compile(decrypted, process.cwd() + '/app.bundle.js');
  } catch (e) {
    console.error('[node-jar] Bundle decryption failed. Check APP_SECRET environment variable.');
    console.error('[node-jar] Error:', e.message);
    process.exit(1);
  }
})();`;
}

function resolveSecret(keySource) {
  if (!keySource || keySource === 'env') {
    return process.env.APP_SECRET || process.env.NODE_JAR_SECRET || 'node-jar-default-secret';
  }
  if (keySource.startsWith('file:')) {
    const fs = require('fs');
    const filePath = keySource.slice(5);
    return fs.readFileSync(filePath, 'utf8').trim();
  }
  return keySource;
}

module.exports = { encryptBundle, wrapWithDecryptor };
