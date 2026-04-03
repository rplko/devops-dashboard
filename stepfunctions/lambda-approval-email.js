const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({ region: 'us-east-1' });
const apiGatewayUrl = process.env.API_GATEWAY_URL;
const fromEmail = process.env.FROM_EMAIL;
const toEmail = process.env.TO_EMAIL;

exports.handler = async (event) => {
  const taskToken = event.TaskToken;
  const environment = event.Environment;
  const message = event.Message;

  const encodedToken = encodeURIComponent(taskToken);
  const approveUrl = `${apiGatewayUrl}/approve?taskToken=${encodedToken}&action=approve`;
  const rejectUrl = `${apiGatewayUrl}/approve?taskToken=${encodedToken}&action=reject`;

  const emailBody = `
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Deployment Approval Required</h2>
      <p>${message}</p>
      <p>Environment: <strong>${environment}</strong></p>
      <br/>
      <a href="${approveUrl}"
         style="background-color: #28a745; color: white; padding: 12px 24px;
                text-decoration: none; border-radius: 4px; margin-right: 10px;">
        Approve Deployment
      </a>
      <a href="${rejectUrl}"
         style="background-color: #dc3545; color: white; padding: 12px 24px;
                text-decoration: none; border-radius: 4px;">
        Reject Deployment
      </a>
      <br/><br/>
      <p style="color: #666; font-size: 12px;">
        This approval link expires in 24 hours.
      </p>
    </body>
    </html>
  `;

  const command = new SendEmailCommand({
    Destination: {
      ToAddresses: [toEmail]
    },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: emailBody
        }
      },
      Subject: {
        Charset: 'UTF-8',
        Data: `[DevOps Dashboard] Approval needed for ${environment} deployment`
      }
    },
    Source: fromEmail
  });

  await ses.send(command);

  return {
    status: 'email sent',
    environment: environment,
    approveUrl: approveUrl
  };
};