const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');

async function main() {
  if (!config.mongoUri || !config.jwtSecret) throw new Error('MONGODB_URI and JWT_SECRET must be set (see .env.example)');
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  await mongoose.syncIndexes();
  app.listen(config.port, () => console.log(`Halyard API listening on :${config.port}`));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
