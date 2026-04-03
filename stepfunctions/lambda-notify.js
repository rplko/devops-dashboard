exports.handler = async (event) => {
  const status = event.status;
  const environment = event.environment;
  const message = event.message;

  console.log(`[${new Date().toISOString()}] Deployment ${status} on ${environment}`);
  console.log(`Message: ${message}`);

  return {
    status: status,
    environment: environment,
    message: message,
    timestamp: new Date().toISOString()
  };
};