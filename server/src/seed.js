
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('./config');
const User = require('./models/User');
const Team = require('./models/Team');
const WorkItem = require('./models/WorkItem');
const Activity = require('./models/ActivityLog');
const Comment = require('./models/ActivityLog') && require('./models/Comment');
const { PRIORITY_RANK } = require('./services/workflow');

(async () => {
  if (process.argv[2] !== '--confirm-wipe') {
    console.error('Refusing to run: this script DELETES all users, teams, work items, comments and activity in the target database.\nRe-run with:  npm run seed -- --confirm-wipe   (only on a disposable demo database)');
    process.exit(1);
  }
  await mongoose.connect(config.mongoUri);
  console.log('Seeding database:', mongoose.connection.name);
  await Promise.all([User, Team, WorkItem, Activity, Comment].map((m) => m.deleteMany({})));
  const hash = await bcrypt.hash('halyard123', 10);
  const [payments, platform, support] = await Team.create([
    { name: 'Payments Ops', key: 'PAY' }, { name: 'Platform Engineering', key: 'PLT' }, { name: 'Customer Support', key: 'SUP' },
  ]);
  const mk = (name, email, role, memberships) => User.create({ name, email, role, passwordHash: hash, memberships });
  const admin = await mk('Ada Admin', 'admin@halyard.test', 'admin', []);
  const maya = await mk('Maya Manager', 'maya@halyard.test', 'user', [{ team: payments._id, role: 'manager' }, { team: support._id, role: 'member' }]);
  const omar = await mk('Omar Member', 'omar@halyard.test', 'user', [{ team: payments._id, role: 'member' }]);
  const priya = await mk('Priya Platform', 'priya@halyard.test', 'user', [{ team: platform._id, role: 'manager' }]);
  const titles = ['Chargeback spike on card ending 4411', 'Reconcile settlement batch', 'Refund stuck in pending', 'API latency alert on checkout', 'Compliance evidence request', 'Approve vendor payout', 'Customer cannot reset password'];
  const cats = ['payment', 'task', 'customer_issue', 'incident', 'compliance', 'approval', 'customer_issue'];
  const prios = ['high', 'medium', 'medium', 'critical', 'low', 'high', 'medium'];
  for (let i = 0; i < 40; i++) {
    const team = [payments, platform, support][i % 3];
    const creator = [maya, omar, priya][i % 3];
    const priority = prios[i % prios.length];
    const status = ['open', 'open', 'in_progress', 'blocked', 'resolved', 'closed', 'in_progress'][i % 7];
    const item = await WorkItem.create({
      title: `${titles[i % titles.length]} #${100 + i}`, description: 'Seeded demo item. Investigate, update the thread, and resolve.',
      category: cats[i % cats.length], priority, priorityRank: PRIORITY_RANK[priority], team: team._id, creator: creator._id,
      status, assignee: status === 'open' ? null : [maya, omar, priya][(i + 1) % 3]._id,
      dueDate: i % 3 === 0 ? new Date(Date.now() + (i % 8 - 3) * 86400000) : null,
    });
    if (status !== 'open') await Activity.create({ workItem: item._id, actor: creator._id, type: 'status_changed', data: { from: 'open', to: status }, versionAfter: 2 });
    if (i % 2 === 0) await Comment.create({ workItem: item._id, author: creator._id, body: 'Picked this up and confirmed the customer impact. Updating once the vendor replies.' });
    await Activity.create({ workItem: item._id, actor: creator._id, type: 'created', data: { title: item.title }, versionAfter: 1 });
  }
  await mongoose.syncIndexes();
  console.log('Seeded. Logins (password halyard123): admin@halyard.test, maya@halyard.test (manager), omar@halyard.test (member), priya@halyard.test');
  await mongoose.disconnect();
})();
