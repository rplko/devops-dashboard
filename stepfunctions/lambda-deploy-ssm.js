const {
  SSMClient,
  SendCommandCommand,
  GetCommandInvocationCommand
} = require('@aws-sdk/client-ssm');

const ssm = new SSMClient({ region: 'us-east-1' });

const INSTANCE_IDS = {
  dc:         process.env.DC_INSTANCE_ID,
  production: process.env.PROD_INSTANCE_ID
};

const COMPOSE_OVERRIDES = {
  dc:         'docker-compose.yml -f docker-compose.dc.yml',
  production: 'docker-compose.yml'
};

/**
 * Polls SSM until the command finishes or times out.
 * Returns the final status + stdout/stderr.
 */
async function waitForCommand(commandId, instanceId, timeoutMs = 300000) {
  const start = Date.now();
  const pollInterval = 5000;

  while (Date.now() - start < timeoutMs) {
    await sleep(pollInterval);

    const result = await ssm.send(new GetCommandInvocationCommand({
      CommandId: commandId,
      InstanceId: instanceId
    }));

    const status = result.StatusDetails;
    console.log(`[SSM] Command ${commandId} status: ${status}`);

    if (['Success', 'Failed', 'Cancelled', 'TimedOut'].includes(status)) {
      return {
        status,
        stdout: result.StandardOutputContent || '',
        stderr: result.StandardErrorContent  || ''
      };
    }
  }

  throw new Error(`SSM command ${commandId} timed out after ${timeoutMs / 1000}s`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

exports.handler = async (event) => {
  const environment = event.environment;
  const commit      = event.commit      || 'unknown';
  const branch      = event.branch      || 'main';

  console.log(`[Deploy] Starting SSM deployment to ${environment}`);
  console.log(`[Deploy] Commit: ${commit} | Branch: ${branch}`);

  const instanceId = INSTANCE_IDS[environment];
  if (!instanceId) {
    throw new Error(`No instance ID configured for environment: ${environment}`);
  }

  const composeFiles = COMPOSE_OVERRIDES[environment];

  // The shell script SSM will run on the EC2 instance
  const deployScript = [
  'set -e',
  'export HOME=/root',   // 🔥 FIX for git
  'echo "=== NEW VERSION V6 ==="',
  'echo "[Deploy] Starting deployment on $(hostname) at $(date)"',

  'APP_DIR=/home/ubuntu/devops-dashboard',

  'if [ ! -d "$APP_DIR" ]; then',
  '  echo "[Deploy] First-time setup: cloning repo..."',
  '  git clone https://github.com/rplko/devops-dashboard.git $APP_DIR',
  'fi',

  'git config --global --add safe.directory /home/ubuntu/devops-dashboard',

  'cd $APP_DIR',

  'echo "[Deploy] Fixing permissions..."',
  'chmod -R 755 $APP_DIR',

  'echo "[Deploy] Pulling latest code..."',
  'git fetch origin',
  `git reset --hard origin/${branch}`,

  'echo "[Deploy] Code updated successfully"',

  'echo "[Deploy] Cleaning Docker system..."',
  'sudo docker system prune -a -f',
  'sudo docker builder prune -a -f',

  'echo "[Deploy] Restarting containers..."',
  `sudo docker compose -f ${composeFiles} down`,
  `sudo docker compose -f ${composeFiles} build --no-cache`,
  `sudo docker compose -f ${composeFiles} up -d`,

  'echo "[Deploy] Cleaning up old containers..."',
  'sudo docker container prune -f',

  'echo "[Deploy] Deployment complete at $(date)"'
].join('\n');

  // Send the command via SSM Run Command
  const sendResult = await ssm.send(new SendCommandCommand({
    InstanceIds:    [instanceId],
    DocumentName:   'AWS-RunShellScript',
    Parameters:     { commands: [deployScript] },
    Comment:        `devops-dashboard deploy ${environment} @ ${commit}`,
    TimeoutSeconds: 300
  }));

  const commandId = sendResult.Command.CommandId;
  console.log(`[SSM] Command sent. CommandId: ${commandId}`);

  // Wait for it to finish
  const result = await waitForCommand(commandId, instanceId);

  console.log(`[SSM] stdout:\n${result.stdout}`);
  if (result.stderr) console.log(`[SSM] stderr:\n${result.stderr}`);

  if (result.status !== 'Success') {
    throw new Error(
      `SSM deployment failed on ${environment}.\nStatus: ${result.status}\nError: ${result.stderr}`
    );
  }

  return {
    status:      'success',
    environment,
    commandId,
    commit,
    branch,
    timestamp:   new Date().toISOString(),
    output:      result.stdout
  };
};