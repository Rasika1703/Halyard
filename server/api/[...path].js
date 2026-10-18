const handler = require('../src/server');

module.exports = (req, res) => {
  return handler(req, res);
};