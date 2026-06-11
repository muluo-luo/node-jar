// Integration test: bundle a simple Express app and verify it works
const { test } = require('node:test');
const assert = require('node:assert');
const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'simple-express');
const BUNDLE_PATH = path.join(FIXTURE_DIR, 'dist', 'app.bundle.js');
const PORT = 3199;

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    }).on('error', reject);
  });
}

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

test('nar bundles and runs Express app', { timeout: 30000 }, async (t) => {
  let serverProcess;

  await t.test('bundle produces valid output file', async () => {
    const { build } = require('../src/index');
    const result = await build({
      cwd: FIXTURE_DIR,
      entry: path.join(FIXTURE_DIR, 'src', 'app.js'),
      output: BUNDLE_PATH,
      static: ['public'],
      minify: true,
    });

    assert.ok(result.outputPath);
    assert.ok(result.stats.finalSize > 50000);
    assert.ok(result.stats.assetCount >= 1);
    assert.strictEqual(result.stats.framework, 'express');
  });

  await t.test('bundled server starts and serves requests', async () => {
    serverProcess = spawn('node', [BUNDLE_PATH], {
      cwd: FIXTURE_DIR,
      env: { ...process.env, PORT: String(PORT) },
      stdio: 'pipe',
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Server start timeout')), 10000);
      serverProcess.stdout.on('data', (chunk) => {
        output += chunk.toString();
        if (output.includes('Server running') || output.includes('0.0.0.0')) {
          clearTimeout(timer);
          setTimeout(resolve, 500);
        }
      });
      serverProcess.stderr.on('data', (chunk) => {
        output += chunk.toString();
      });
      serverProcess.on('error', reject);
    });

    // Test API endpoint
    const pingResp = await httpGet('/api/ping');
    assert.strictEqual(pingResp.status, 200);
    const pingData = JSON.parse(pingResp.data);
    assert.strictEqual(pingData.ok, true);

    // Test POST endpoint
    const echoResp = await httpPost('/api/echo', { test: 'hello-world' });
    assert.strictEqual(echoResp.status, 200);
    const echoData = JSON.parse(echoResp.data);
    assert.strictEqual(echoData.received.test, 'hello-world');

    // Test static file via virtual FS
    const staticResp = await httpGet('/');
    assert.strictEqual(staticResp.status, 200);
    assert.ok(staticResp.data.includes('Hello from nar bundle!'));
  });

  await t.test('bundled server handles 404 for missing routes', async () => {
    const resp = await httpGet('/nonexistent');
    assert.strictEqual(resp.status, 404);
  });

  // Cleanup
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
});
