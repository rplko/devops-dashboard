/**
 * Integration tests for devops-dashboard
 */

// Mock dockerode before anything else
const Module = require('module');
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (name === 'dockerode') {
    return class DockerMock {
      listContainers() { return Promise.resolve([]); }
      getContainer() {
        return {
          stats: () => Promise.resolve({
            memory_stats: { usage: 100, limit: 1000 }
          })
        };
      }
    };
  }
  return originalLoad.apply(this, [name, ...args]);
};

const http = require('http');

const BASE_URL = 'http://127.0.0.1:3000';

require('../server.js');

function waitForServer(retries = 10) {
  return new Promise((resolve, reject) => {
    function attempt(n) {
      http.get(BASE_URL + '/health', (res) => {
        resolve();
      }).on('error', (err) => {
        if (n <= 0) return reject(new Error('Server never became ready'));
        setTimeout(() => attempt(n - 1), 500);
      });
    }
    attempt(retries);
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE_URL + path, (res) => {
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
    console.log('  PASS  ' + name);
    passed++;
  } catch (err) {
    console.log('  FAIL  ' + name);
    console.log('        ' + err.message);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function runTests() {
  console.log('\nRunning tests against ' + BASE_URL + '\n');

  await waitForServer();

  await test('GET /health returns 200 and status UP', async () => {
    const { status, body } = await get('/health');
    assert(status === 200, 'Expected 200, got ' + status);
    const json = JSON.parse(body);
    assert(json.status === 'UP', 'Expected status UP, got ' + json.status);
  });

  await test('GET /info returns hostname and platform', async () => {
    const { status, body } = await get('/info');
    assert(status === 200, 'Expected 200, got ' + status);
    const json = JSON.parse(body);
    assert(json.hostname, 'Missing hostname');
    assert(json.platform, 'Missing platform');
  });

  await test('GET /metrics returns memory stats', async () => {
    const { status, body } = await get('/metrics');
    assert(status === 200, 'Expected 200, got ' + status);
    const json = JSON.parse(body);
    assert(json.total_memory > 0, 'Missing total_memory');
    assert(json.memory_usage_percent, 'Missing memory_usage_percent');
  });

  await test('GET /api/cpu returns cpu usage', async () => {
    const { status, body } = await get('/api/cpu');
    assert(status === 200, 'Expected 200, got ' + status);
    const json = JSON.parse(body);
    assert(typeof json.cpu === 'number', 'cpu should be a number');
  });

  await test('GET /api/memory returns total/used/free', async () => {
    const { status, body } = await get('/api/memory');
    assert(status === 200, 'Expected 200, got ' + status);
    const json = JSON.parse(body);
    assert(json.total, 'Missing total memory');
    assert(json.used, 'Missing used memory');
    assert(json.free, 'Missing free memory');
  });

  await test('GET /api/system returns hostname and uptime', async () => {
    const { status, body } = await get('/api/system');
    assert(status === 200, 'Expected 200, got ' + status);
    const json = JSON.parse(body);
    assert(json.hostname, 'Missing hostname');
    assert(json.uptime, 'Missing uptime');
  });

  await test('GET /api/logs returns 200', async () => {
    const { status } = await get('/api/logs');
    assert(status === 200, 'Expected 200, got ' + status);
  });

  await test('GET /metrics/deployments returns success status', async () => {
    const { status, body } = await get('/metrics/deployments');
    assert(status === 200, 'Expected 200, got ' + status);
    const json = JSON.parse(body);
    assert(json.status === 'success', 'Expected status success');
  });

  await test('GET / returns 200', async () => {
    const { status } = await get('/');
    assert(status === 200, 'Expected 200, got ' + status);
  });

  await test('GET /dashboard returns 200', async () => {
    const { status } = await get('/dashboard');
    assert(status === 200, 'Expected 200, got ' + status);
  });

  await test('GET /blog returns 200', async () => {
    const { status } = await get('/blog');
    assert(status === 200, 'Expected 200, got ' + status);
  });

  await test('GET /about returns 200', async () => {
    const { status } = await get('/about');
    assert(status === 200, 'Expected 200, got ' + status);
  });

  await test('GET /projects returns 200', async () => {
    const { status } = await get('/projects');
    assert(status === 200, 'Expected 200, got ' + status);
  });

  await test('GET /contact returns 200', async () => {
    const { status } = await get('/contact');
    assert(status === 200, 'Expected 200, got ' + status);
  });

  await test('GET /blog/nonexistent returns Post not found', async () => {
    const { status, body } = await get('/blog/nonexistent-id-xyz');
    assert(status === 200, 'Expected 200, got ' + status);
    assert(body.includes('Post not found'), 'Expected Post not found message');
  });

  console.log('\n  Results: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});