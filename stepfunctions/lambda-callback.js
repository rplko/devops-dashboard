const { SFNClient, SendTaskSuccessCommand, SendTaskFailureCommand } = require('@aws-sdk/client-sfn');

const sfn = new SFNClient({ region: 'us-east-1' });

exports.handler = async (event) => {
  const taskToken = decodeURIComponent(event.queryStringParameters.taskToken);
  const action = event.queryStringParameters.action;

  try {
    if (action === 'approve') {
      await sfn.send(new SendTaskSuccessCommand({
        taskToken: taskToken,
        output: JSON.stringify({
          approved: true,
          action: 'approve',
          timestamp: new Date().toISOString()
        })
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <html>
          <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #28a745;">Deployment Approved!</h1>
            <p>The deployment pipeline is now continuing to the next stage.</p>
            <p>You can close this tab.</p>
          </body>
          </html>
        `
      };
    } else {
      await sfn.send(new SendTaskFailureCommand({
        taskToken: taskToken,
        error: 'DeploymentRejected',
        cause: 'Deployment was manually rejected'
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <html>
          <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #dc3545;">Deployment Rejected</h1>
            <p>The deployment pipeline has been stopped.</p>
            <p>You can close this tab.</p>
          </body>
          </html>
        `
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: #dc3545;">Error</h1>
          <p>${err.message}</p>
          <p>The link may have already been used or expired.</p>
        </body>
        </html>
      `
    };
  }
};