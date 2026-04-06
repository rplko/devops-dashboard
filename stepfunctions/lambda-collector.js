const https = require('https');
const http = require('http');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({ region: 'us-east-1' });
const BUCKET = 'devops-dashboard-metrics-029139774327';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://44.222.215.213:3000';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'rplko/devops-dashboard';

function getTimeParts() {
  const now = new Date();
  return {
    year: now.getUTCFullYear().toString(),
    month: String(now.getUTCMonth() + 1).padStart(2, '0'),
    day: String(now.getUTCDate()).padStart(2, '0'),
    hour: String(now.getUTCHours()).padStart(2, '0'),
    minute: String(now.getUTCMinutes()).padStart(2, '0'),
    timestamp: now.toISOString()
  };
}

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const options = { headers: { 'User-Agent': 'devops-dashboard-collector', ...headers } };
    protocol.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve(data); }
      });
    }).on('error', reject);
  });
}

async function writeToS3(folder, data, timeParts) {
  const key = `${folder}/year=${timeParts.year}/month=${timeParts.month}/day=${timeParts.day}/hour=${timeParts.hour}/${timeParts.minute}.json`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(data),
    ContentType: 'application/json'
  }));
  console.log(`Written to s3://${BUCKET}/${key}`);
}

async function collectMetrics(timeParts) {
  try {
    const [memory, cpu, system] = await Promise.all([
      httpGet(`${DASHBOARD_URL}/api/memory`),
      httpGet(`${DASHBOARD_URL}/api/cpu`),
      httpGet(`${DASHBOARD_URL}/api/system`)
    ]);

    const data = {
      timestamp: timeParts.timestamp,
      memory_total_mb: parseFloat(memory.total),
      memory_used_mb: parseFloat(memory.used),
      memory_free_mb: parseFloat(memory.free),
      cpu_usage_percent: cpu.cpu,
      hostname: system.hostname,
      platform: system.platform,
      uptime_minutes: parseFloat(system.uptime),
      cpu_count: system.cpus
    };

    await writeToS3('metrics', data, timeParts);
    console.log('Metrics collected successfully');
  } catch (err) {
    console.error('Failed to collect metrics:', err.message);
  }
}

async function collectGitHubActions(timeParts) {
  try {
    const data = await httpGet(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/runs?per_page=10`,
      { Authorization: `token ${GITHUB_TOKEN}` }
    );

    const runs = data.workflow_runs.map(run => ({
      timestamp: timeParts.timestamp,
      run_id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      branch: run.head_branch,
      commit: run.head_sha.substring(0, 7),
      started_at: run.run_started_at,
      updated_at: run.updated_at,
      duration_seconds: run.run_started_at && run.updated_at
        ? Math.round((new Date(run.updated_at) - new Date(run.run_started_at)) / 1000)
        : null
    }));

    await writeToS3('github_actions', { timestamp: timeParts.timestamp, runs }, timeParts);
    console.log('GitHub Actions collected successfully');
  } catch (err) {
    console.error('Failed to collect GitHub Actions:', err.message);
  }
}

async function collectDockerStats(timeParts) {
  try {
    const containers = await httpGet(`${DASHBOARD_URL}/api/container-stats`);

    const data = {
      timestamp: timeParts.timestamp,
      container_count: containers.length,
      containers: containers.map(c => ({
        name: c.name,
        status: c.status,
        memory_percent: parseFloat(c.memoryPercent)
      }))
    };

    await writeToS3('docker_stats', data, timeParts);
    console.log('Docker stats collected successfully');
  } catch (err) {
    console.error('Failed to collect Docker stats:', err.message);
  }
}

exports.handler = async (event) => {
  console.log('Starting data collection...');
  const timeParts = getTimeParts();

  await Promise.all([
    collectMetrics(timeParts),
    collectGitHubActions(timeParts),
    collectDockerStats(timeParts)
  ]);

  console.log('Data collection complete!');
  return { status: 'success', timestamp: timeParts.timestamp };
};