const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const config = require('../src/config');
const User = require('../src/models/User');
const Team = require('../src/models/Team');
const WorkItem = require('../src/models/WorkItem');

let mem;
async function connect() {
  let uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mem = await MongoMemoryServer.create();
    uri = mem.getUri();
  }
  await mongoose.connect(uri, { dbName: 'halyard_test' });
  await mongoose.connection.dropDatabase();
 
  for (const m of mongoose.modelNames()) {
    try { await mongoose.model(m).createIndexes(); } catch (e) { /* text index unsupported on some Mongo-compatible servers */ }
  }
}
async function disconnect() {
  await mongoose.disconnect();
  if (mem) await mem.stop();
}
async function reset() {
  await Promise.all(mongoose.modelNames().map((m) => mongoose.model(m).deleteMany({})));
}

let n = 0;
async function makeUser({ role = 'user', memberships = [], name } = {}) {
  n += 1;
  return User.create({ name: name || `User ${n}`, email: `user${n}-${Date.now()}@t.test`, role, memberships, passwordHash: await bcrypt.hash('password123', 4) });
}
const makeTeam = (key = 'AAA') => Team.create({ name: `Team ${key}${Math.random()}`, key });

/** Returns an API client that authenticates as `user` (Bearer token; same middleware path as the cookie). */
function as(user) {
  const token = jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: '1h' });
  const base = (method, url) => request(app)[method](url).set('Authorization', `Bearer ${token}`).set('X-Requested-With', 'halyard');
  let k = 0;
  return {
    get: (u) => base('get', u),
    post: (u, body) => base('post', u).send(body),
    patch: (u, body) => base('patch', u).send(body),
    create: (body, key) => base('post', '/api/work-items').set('Idempotency-Key', key || `k-${Date.now()}-${k++}-${Math.random()}`).send(body),
  };
}
const anon = () => ({
  get: (u) => request(app).get(u),
  post: (u, b) => request(app).post(u).set('X-Requested-With', 'halyard').send(b),
});

async function makeItem(team, creator, over = {}) {
  return WorkItem.create({ title: 'Seeded item', team: team._id, creator: creator._id, ...over });
}
module.exports = { connect, disconnect, reset, makeUser, makeTeam, makeItem, as, anon, app, request };
