const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;

function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'devops-dashboard-lambda',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getDeploymentId(environment) {
  const deployments = await githubRequest('GET', `/repos/${GITHUB_REPO}/deployments?environment=${environment}&per_page=1`);
  if (deployments && deployments.length > 0) {
    return deployments[0].id;
  }
  return null;
}

async function updateDeploymentStatus(deploymentId, state, environment) {

  const environmentUrls = {
    dc: 'http://98.92.57.61:3000',
    production: 'http://98.92.57.61:3000'
  };

  await githubRequest('POST', `/repos/${GITHUB_REPO}/deployments/${deploymentId}/statuses`, {
    state: state,
    environment_url: environmentUrls[environment] || '',
    description: state === 'success'
      ? `Deployed to ${environment} successfully`
      : `Deployment to ${environment} failed`,
    auto_inactive: true
  });
}

exports.handler = async (event) => {
  const status = event.status;
  const environment = event.environment;
  const message = event.message;

  console.log(`[${new Date().toISOString()}] Deployment ${status} on ${environment}`);
  console.log(`Message: ${message}`);

  if (GITHUB_TOKEN && GITHUB_REPO && (environment === 'dc' || environment === 'production')) {
    try {
      const deploymentId = await getDeploymentId(environment);
      if (deploymentId) {
        const githubState = status === 'success' ? 'success' : 'failure';
        await updateDeploymentStatus(deploymentId, githubState, environment);
        console.log(`GitHub deployment status updated: ${githubState} for ${environment}`);
      } else {
        console.log(`No deployment found for environment: ${environment}`);
      }
    } catch (err) {
      console.log(`Failed to update GitHub deployment status: ${err.message}`);
    }
  }

  return {
    status: status,
    environment: environment,
    message: message,
    timestamp: new Date().toISOString()
  };
};