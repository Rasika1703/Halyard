const handler = require('../src/server');

module.exports = (req, res) => {

  if (!req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return handler(req, res);
};