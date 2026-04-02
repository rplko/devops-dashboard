/**
 * Integration tests for devops-dashboard
 * Run with: npm test
 *
 * Start your server first with: node server.js
 * Then in another terminal run: npm test
 */

const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    http.get(url.toString(), (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌  ${name}`);
    console.log(`       ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function runTests() {
  console.log(`\n🧪  Running tests against ${BASE_URL}\n`);

  await test('GET /health returns 200 and status UP', async () => {
    const { status, body } = await get('/health');
    assert(status === 200, `Expected 200, got ${status}`);
    const json = JSON.parse(body);
    assert(json.status === 'UP', `Expected status UP, got ${json.status}`);
  });

  await test('GET /info returns hostname and platform', async () => {
    const { status, body } = await get('/info');
    assert(status === 200, `Expected 200, got ${status}`);
    const json = JSON.parse(body);
    assert(json.hostname, 'Missing hostname');
    assert(json.platform, 'Missing platform');
  });

  await test('GET /metrics returns memory stats', async () => {
    const { status, body } = await get('/metrics');
    assert(status === 200, `Expected 200, got ${status}`);
    const json = JSON.parse(body);
    assert(json.total_memory > 0, 'Missing total_memory');
    assert(json.memory_usage_percent, 'Missing memory_usage_percent');
  });

  await test('GET /api/cpu returns cpu usage', async () => {
    const { status, body } = await get('/api/cpu');
    assert(status === 200, `Expected 200, got ${status}`);
    const json = JSON.parse(body);
    assert(typeof json.cpu === 'number', 'cpu should be a number');
  });

  await test('GET /api/memory returns total/used/free', async () => {
    const { status, body } = await get('/api/memory');
    assert(status === 200, `Expected 200, got ${status}`);
    const json = JSON.parse(body);
    assert(json.total, 'Missing total memory');
    assert(json.used, 'Missing used memory');
    assert(json.free, 'Missing free memory');
  });

  await test('GET /api/system returns hostname and uptime', async () => {
    const { status, body } = await get('/api/system');
    assert(status === 200, `Expected 200, got ${status}`);
    const json = JSON.parse(body);
    assert(json.hostname, 'Missing hostname');
    assert(json.uptime, 'Missing uptime');
  });

  await test('GET /api/logs returns 200', async () => {
    const { status } = await get('/api/logs');
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test('GET /metrics/deployments returns success status', async () => {
    const { status, body } = await get('/metrics/deployments');
    assert(status === 200, `Expected 200, got ${status}`);
    const json = JSON.parse(body);
    assert(json.status === 'success', 'Expected status success');
  });

  await test('GET / returns 200', async () => {
    const { status } = await get('/');
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test('GET /dashboard returns 200', async () => {
    const { status } = await get('/dashboard');
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test('GET /blog returns 200', async () => {
    const { status } = await get('/blog');
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test('GET /about returns 200', async () => {
    const { status } = await get('/about');
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test('GET /projects returns 200', async () => {
    const { status } = await get('/projects');
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test('GET /contact returns 200', async () => {
    const { status } = await get('/contact');
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test('GET /blog/nonexistent returns "Post not found"', async () => {
    const { status, body } = await get('/blog/nonexistent-id-xyz');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.includes('Post not found'), 'Expected "Post not found" message');
  });

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});