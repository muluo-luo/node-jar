const { info, success, warn } = require('./utils');

function obfuscate(code, options = {}) {
  let obfuscator;
  try {
    obfuscator = require('javascript-obfuscator');
  } catch (e) {
    warn('未安装 javascript-obfuscator，跳过混淆。请执行: npm install -D javascript-obfuscator');
    return code;
  }

  info('代码混淆中...');
  const opts = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.2,
    stringArray: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayThreshold: 0.75,
    stringArrayEncoding: ['base64'],
    splitStrings: true,
    splitStringsChunkLength: 5,
    unicodeEscapeSequence: false,
    selfDefending: false,
    transformObjectKeys: true,
    ...options,
  };

  const result = obfuscator.obfuscate(code, opts);
  const obfuscated = result.getObfuscatedCode();
  success('代码混淆完成');
  return obfuscated;
}

module.exports = { obfuscate };
