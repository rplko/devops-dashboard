const https = require('https');
const http = require('http');

exports.handler = async (event) => {
  const url = event.health_url;
  const protocol = url.startsWith('https') ? https : http;

  return new Promise((resolve, reject) => {
    protocol.get(url, (res) => {
      if (res.statusCode === 200) {
        resolve({
          status: 'healthy',
          statusCode: res.statusCode,
          environment: event.environment,
          url: url
        });
      } else {
        reject(new Error(`Health check failed with status ${res.statusCode}`));
      }
    }).on('error', (err) => {
      reject(new Error(`Health check failed: ${err.message}`));
    });
  });
};