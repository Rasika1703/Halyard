const h = require('./helpers');
const User = require('../src/models/User');
const WorkItem = require('../src/models/WorkItem');
const Activity = require('../src/models/ActivityLog');


const raceTest = process.env.NON_ATOMIC_DB ? test.skip : test;

beforeAll(h.connect);
afterAll(h.disconnect);
beforeEach(h.reset);

async function world() {
  const team = await h.makeTeam('PAY');
  const other = await h.makeTeam('SEC');
  const manager = await h.makeUser({ memberships: [{ team: team._id, role: 'manager' }] });
  const member = await h.makeUser({ memberships: [{ team: team._id, role: 'member' }] });
  const bystander = await h.makeUser({ memberships: [{ team: team._id, role: 'member' }] });
  const outsider = await h.makeUser({ memberships: [{ team: other._id, role: 'manager' }] });
  const admin = await h.makeUser({ role: 'admin' });
  return { team, other, manager, member, bystander, outsider, admin };
}
const body = (team, over = {}) => ({ title: 'Investigate failed payout', team: String(team._id), priority: 'high', ...over });

describe('authentication', () => {
  test('registration hashes the password and never returns it', async () => {
    const res = await h.anon().post('/api/auth/register', { name: 'Zed Tester', email: 'ZED@Example.com', password: 'longenough1' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('zed@example.com');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|longenough1/);
    const stored = await User.findOne({ email: 'zed@example.com' }).select('+passwordHash');
    expect(stored.passwordHash).not.toBe('longenough1');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(res.headers['set-cookie'].join(';')).toMatch(/HttpOnly/i);
  });
  test('rejects short passwords and duplicate emails', async () => {
    const bad = await h.anon().post('/api/auth/register', { name: 'Zed', email: 'z@z.com', password: 'short' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.password).toBeDefined();
    await h.anon().post('/api/auth/register', { name: 'Zed', email: 'z@z.com', password: 'longenough1' });
    const dup = await h.anon().post('/api/auth/register', { name: 'Zed', email: 'z@z.com', password: 'longenough1' });
    expect(dup.status).toBe(409);
  });
  test('login fails with the same message for wrong password and unknown email', async () => {
    await h.anon().post('/api/auth/register', { name: 'Zed', email: 'z@z.com', password: 'longenough1' });
    const a = await h.anon().post('/api/auth/login', { email: 'z@z.com', password: 'wrongwrong' });
    const b = await h.anon().post('/api/auth/login', { email: 'nobody@z.com', password: 'wrongwrong' });
    expect([a.status, b.status]).toEqual([401, 401]);
    expect(a.body.error.message).toBe(b.body.error.message);
    const ok = await h.anon().post('/api/auth/login', { email: 'z@z.com', password: 'longenough1' });
    expect(ok.status).toBe(200);
  });
  test('protected routes reject missing or forged tokens', async () => {
    expect((await h.anon().get('/api/work-items')).status).toBe(401);
    const forged = await h.request(h.app).get('/api/work-items').set('Authorization', 'Bearer not.a.jwt');
    expect(forged.status).toBe(401);
  });
  test('mutating requests without the CSRF header are rejected', async () => {
    const res = await h.request(h.app).post('/api/auth/login').send({ email: 'a@b.com', password: 'x' });
    expect(res.status).toBe(403);
  });
});

describe('resource-level authorization', () => {
  test('users cannot read another team\'s item by guessing its id (404, not 403)', async () => {
    const w = await world();
    const item = await h.makeItem(w.team, w.manager);
    expect((await h.as(w.outsider).get(`/api/work-items/${item._id}`)).status).toBe(404);
    expect((await h.as(w.member).get(`/api/work-items/${item._id}`)).status).toBe(200);
    expect((await h.as(w.admin).get(`/api/work-items/${item._id}`)).status).toBe(200);
  });
  test('outsiders cannot comment, claim, or see comments/activity', async () => {
    const w = await world();
    const item = await h.makeItem(w.team, w.manager);
    const o = h.as(w.outsider);
    expect((await o.post(`/api/work-items/${item._id}/comments`, { body: 'hi' })).status).toBe(404);
    expect((await o.post(`/api/work-items/${item._id}/claim`)).status).toBe(404);
    expect((await o.get(`/api/work-items/${item._id}/activity`)).status).toBe(404);
  });
  test('list results are scoped to the user\'s teams', async () => {
    const w = await world();
    await h.makeItem(w.team, w.manager, { title: 'Payments thing' });
    await h.makeItem(w.other, w.outsider, { title: 'Security thing' });
    const res = await h.as(w.member).get('/api/work-items');
    expect(res.body.items.map((i) => i.title)).toEqual(['Payments thing']);
    // asking explicitly for a foreign team still yields nothing
    const forced = await h.as(w.member).get(`/api/work-items?team=${w.other._id}`);
    expect(forced.body.total).toBe(0);
  });
  test('cannot create an item in a team you do not belong to', async () => {
    const w = await world();
    expect((await h.as(w.outsider).create(body(w.team))).status).toBe(403);
  });
  test('only managers can assign; uninvolved members cannot edit', async () => {
    const w = await world();
    const item = await h.makeItem(w.team, w.manager);
    const assign = { assigneeId: String(w.member._id), version: 1 };
    expect((await h.as(w.member).post(`/api/work-items/${item._id}/assign`, assign)).status).toBe(403);
    expect((await h.as(w.bystander).patch(`/api/work-items/${item._id}`, { version: 1, title: 'Hijacked title' })).status).toBe(403);
    expect((await h.as(w.manager).post(`/api/work-items/${item._id}/assign`, assign)).status).toBe(200);
  });
  test('cannot assign to someone outside the team', async () => {
    const w = await world();
    const item = await h.makeItem(w.team, w.manager);
    const res = await h.as(w.manager).post(`/api/work-items/${item._id}/assign`, { assigneeId: String(w.outsider._id), version: 1 });
    expect(res.status).toBe(400);
  });
  test('only admins can create teams', async () => {
    const w = await world();
    expect((await h.as(w.manager).post('/api/teams', { name: 'New', key: 'NEW' })).status).toBe(403);
    expect((await h.as(w.admin).post('/api/teams', { name: 'New', key: 'NEW' })).status).toBe(201);
  });
});

describe('work item creation and validation', () => {
  test('creates an item with defaults and records a persistent "created" activity', async () => {
    const w = await world();
    const res = await h.as(w.member).create(body(w.team));
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ status: 'open', version: 1, priority: 'high', assignee: null });
    expect(res.body.item.creator.name).toBe(w.member.name);
    const acts = await Activity.find({ workItem: res.body.item.id });
    expect(acts.map((a) => a.type)).toEqual(['created']);
  });
  test('returns field-level validation errors', async () => {
    const w = await world();
    const res = await h.as(w.member).create({ title: 'x', team: String(w.team._id), priority: 'urgent' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty('title');
    expect(res.body.error.fields).toHaveProperty('priority');
  });
  test('malformed ids are a clean 404, never a 500', async () => {
    const w = await world();
    expect((await h.as(w.member).get('/api/work-items/not-an-id')).status).toBe(404);
  });
  test('errors do not leak stack traces', async () => {
    const w = await world();
    const res = await h.as(w.member).get('/api/work-items?limit=9999');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js/);
  });
});

describe('CASE 1 — simultaneous assignment', () => {
  raceTest('when 10 users claim the same item at once, exactly one wins and the rest get 409', async () => {
    const w = await world();
    const team = w.team;
    const users = await Promise.all(Array.from({ length: 10 }, () => h.makeUser({ memberships: [{ team: team._id, role: 'member' }] })));
    const item = await h.makeItem(team, w.manager);

    const results = await Promise.all(users.map((u) => h.as(u).post(`/api/work-items/${item._id}/claim`)));
    const wins = results.filter((r) => r.status === 200);
    const losses = results.filter((r) => r.status === 409);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(9);

    const winnerId = wins[0].body.item.assignee._id || wins[0].body.item.assignee.id;
    const stored = await WorkItem.findById(item._id);
    expect(String(stored.assignee)).toBe(String(winnerId));
    expect(stored.status).toBe('in_progress');
    expect(stored.version).toBe(2); // exactly one successful mutation
    for (const l of losses) {
      expect(l.body.error.code).toBe('ALREADY_CLAIMED');
      expect(String(l.body.error.details.current.assignee._id)).toBe(String(winnerId)); // loser is told the latest owner
    }
    const claims = await Activity.countDocuments({ workItem: item._id, type: 'claimed' });
    expect(claims).toBe(1);
  });
  test('claiming an already-assigned item returns 409 with the current assignee', async () => {
    const w = await world();
    const item = await h.makeItem(w.team, w.manager, { assignee: w.member._id, status: 'in_progress' });
    const res = await h.as(w.bystander).post(`/api/work-items/${item._id}/claim`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(w.member.name);
  });
});

describe('CASE 2 — stale update detection', () => {
  test('an edit based on an old version is rejected and does not overwrite newer data', async () => {
    const w = await world();
    const created = (await h.as(w.manager).create(body(w.team))).body.item;
    // Alice and Bob both load v1
    const bob = await h.as(w.manager).patch(`/api/work-items/${created.id}`, { version: 1, title: 'Bob retitled it' });
    expect(bob.status).toBe(200);
    expect(bob.body.item.version).toBe(2);

    const stale = await h.as(w.member).patch(`/api/work-items/${created.id}`, { version: 1, description: 'Alice stale edit' });
    // member is the creator? no, manager created it -> forbidden is also acceptable protection; use creator for the stale case below
    expect([403, 409]).toContain(stale.status);

    const stale2 = await h.as(w.manager).patch(`/api/work-items/${created.id}`, { version: 1, title: 'Old tab edit' });
    expect(stale2.status).toBe(409);
    expect(stale2.body.error.code).toBe('STALE_UPDATE');
    expect(stale2.body.error.details).toMatchObject({ yourVersion: 1, currentVersion: 2 });
    expect(stale2.body.error.details.current.title).toBe('Bob retitled it');
    expect((await WorkItem.findById(created.id)).title).toBe('Bob retitled it');
  });
  raceTest('two simultaneous edits at the same version: one wins, one gets 409', async () => {
    const w = await world();
    const created = (await h.as(w.manager).create(body(w.team))).body.item;
    const [a, b] = await Promise.all([
      h.as(w.manager).patch(`/api/work-items/${created.id}`, { version: 1, title: 'Title from A' }),
      h.as(w.manager).patch(`/api/work-items/${created.id}`, { version: 1, title: 'Title from B' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await WorkItem.findById(created.id)).version).toBe(2);
  });
  test('status changes and assignment are also version-checked', async () => {
    const w = await world();
    const item = await h.makeItem(w.team, w.manager, { assignee: w.member._id, status: 'in_progress' });
    const res = await h.as(w.member).patch(`/api/work-items/${item._id}/status`, { status: 'resolved', version: 7 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STALE_UPDATE');
    const res2 = await h.as(w.manager).post(`/api/work-items/${item._id}/assign`, { assigneeId: String(w.bystander._id), version: 7 });
    expect(res2.status).toBe(409);
  });
  test('missing version is a validation error, not a silent overwrite', async () => {
    const w = await world();
    const item = await h.makeItem(w.team, w.manager);
    const res = await h.as(w.manager).patch(`/api/work-items/${item._id}`, { title: 'No version sent' });
    expect(res.status).toBe(400);
  });
});

describe('CASE 3 — duplicate submission protection', () => {
  test('retrying with the same Idempotency-Key returns the original item, not a duplicate', async () => {
    const w = await world();
    const c = h.as(w.member);
    const first = await c.create(body(w.team), 'key-abc');
    const second = await c.create(body(w.team), 'key-abc');
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body.item.id).toBe(first.body.item.id);
    expect(await WorkItem.countDocuments({})).toBe(1);
    expect(await Activity.countDocuments({ type: 'created' })).toBe(1);
  });
  test('five truly simultaneous submissions with one key create exactly one item', async () => {
    const w = await world();
    const c = h.as(w.member);
    const results = await Promise.all(Array.from({ length: 5 }, () => c.create(body(w.team), 'burst-key')));
    expect(results.every((r) => [200, 201].includes(r.status))).toBe(true);
    expect(new Set(results.map((r) => r.body.item.id)).size).toBe(1);
    expect(await WorkItem.countDocuments({})).toBe(1);
    expect(await Activity.countDocuments({ type: 'created' })).toBe(1);
  });
  test('the same key with a different payload is rejected (422)', async () => {
    const w = await world();
    const c = h.as(w.member);
    await c.create(body(w.team), 'k1');
    const res = await c.create(body(w.team, { title: 'A different request' }), 'k1');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });
  test('keys are scoped per user, and a missing key is rejected', async () => {
    const w = await world();
    await h.as(w.member).create(body(w.team), 'shared');
    await h.as(w.bystander).create(body(w.team), 'shared');
    expect(await WorkItem.countDocuments({})).toBe(2);
    const noKey = await h.request(h.app).post('/api/work-items').set('Authorization', 'Bearer x').set('X-Requested-With', 'halyard').send(body(w.team));
    expect([400, 401]).toContain(noKey.status);
  });
  test('a failed first attempt does not poison the key', async () => {
    const w = await world();
    const bad = await h.as(w.member).create({ ...body(w.team), title: 'x' }, 'retry-key'); // fails validation before any record
    expect(bad.status).toBe(400);
    const ok = await h.as(w.member).create(body(w.team), 'retry-key');
    expect(ok.status).toBe(201);
  });
});

describe('workflow rules', () => {
  test('rejects illegal transitions and requires an assignee to start/resolve', async () => {
    const w = await world();
    const item = await h.makeItem(w.team, w.manager);
    const noOwner = await h.as(w.manager).patch(`/api/work-items/${item._id}/status`, { status: 'in_progress', version: 1 });
    expect(noOwner.status).toBe(422);
    expect(noOwner.body.error.code).toBe('INVALID_TRANSITION');
    const skip = await h.as(w.manager).patch(`/api/work-items/${item._id}/status`, { status: 'closed', version: 1 });
    expect(skip.status).toBe(422);
  });
  test('full happy path: claim -> blocked -> in_progress -> resolved -> closed (manager only)', async () => {
    const w = await world();
    const c = (await h.as(w.member).create(body(w.team))).body.item;
    let it = (await h.as(w.member).post(`/api/work-items/${c.id}/claim`)).body.item;
    for (const s of ['blocked', 'in_progress', 'resolved']) {
      const r = await h.as(w.member).patch(`/api/work-items/${c.id}/status`, { status: s, version: it.version });
      expect(r.status).toBe(200);
      it = r.body.item;
    }
    expect(it.resolvedAt).toBeTruthy();
    const memberClose = await h.as(w.member).patch(`/api/work-items/${c.id}/status`, { status: 'closed', version: it.version });
    expect(memberClose.status).toBe(422);
    const mgrClose = await h.as(w.manager).patch(`/api/work-items/${c.id}/status`, { status: 'closed', version: it.version });
    expect(mgrClose.status).toBe(200);
    // closed items are frozen
    const edit = await h.as(w.manager).patch(`/api/work-items/${c.id}`, { version: mgrClose.body.item.version, title: 'Edit after close' });
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe('ITEM_CLOSED');
  });
  test('a member who is not the assignee cannot change status', async () => {
    const w = await world();
    const item = await h.makeItem(w.team, w.manager, { assignee: w.member._id, status: 'in_progress' });
    const res = await h.as(w.bystander).patch(`/api/work-items/${item._id}/status`, { status: 'blocked', version: 1 });
    expect(res.status).toBe(403);
  });
});

describe('history, comments, list/filter', () => {
  test('every important change is persisted in the activity log in order', async () => {
    const w = await world();
    const c = (await h.as(w.manager).create(body(w.team))).body.item;
    let r = await h.as(w.manager).post(`/api/work-items/${c.id}/assign`, { assigneeId: String(w.member._id), version: 1 });
    r = await h.as(w.manager).patch(`/api/work-items/${c.id}`, { version: r.body.item.version, priority: 'critical', title: 'Escalated payout failure' });
    r = await h.as(w.member).patch(`/api/work-items/${c.id}/status`, { status: 'in_progress', version: r.body.item.version });
    await h.as(w.member).post(`/api/work-items/${c.id}/comments`, { body: 'Looking into it' });
    const act = await h.as(w.member).get(`/api/work-items/${c.id}/activity`);
    expect(act.body.activity.map((a) => a.type).reverse()).toEqual(['created', 'assigned', 'priority_changed', 'edited', 'status_changed', 'commented']);
    const pr = act.body.activity.find((a) => a.type === 'priority_changed');
    expect(pr.data).toEqual({ from: 'high', to: 'critical' });
    const comments = await h.as(w.member).get(`/api/work-items/${c.id}/comments`);
    expect(comments.body.comments[0].body).toBe('Looking into it');
  });
  test('rejects empty comments', async () => {
    const w = await world();
    const item = await h.makeItem(w.team, w.manager);
    expect((await h.as(w.member).post(`/api/work-items/${item._id}/comments`, { body: '   ' })).status).toBe(400);
  });
  test('server-side filtering, sorting and pagination', async () => {
    const w = await world();
    const P = { low: 1, medium: 2, high: 3, critical: 4 };
    for (let i = 0; i < 25; i++) {
      const priority = ['low', 'medium', 'high', 'critical'][i % 4];
      await h.makeItem(w.team, w.manager, { title: `Item number ${i}`, priority, priorityRank: P[priority], status: i % 5 === 0 ? 'blocked' : 'open', assignee: i % 2 ? w.member._id : null });
    }
    const c = h.as(w.member);
    const p1 = await c.get('/api/work-items?limit=10&page=1');
    expect(p1.body).toMatchObject({ total: 25, pages: 3, page: 1 });
    expect(p1.body.items).toHaveLength(10);
    expect((await c.get('/api/work-items?limit=10&page=3')).body.items).toHaveLength(5);
    expect((await c.get('/api/work-items?status=blocked')).body.total).toBe(5);
    expect((await c.get('/api/work-items?priority=high,critical')).body.total).toBe(12);
    expect((await c.get('/api/work-items?assignee=me')).body.total).toBe(12);
    expect((await c.get('/api/work-items?assignee=unassigned')).body.total).toBe(13);
    const byPrio = await c.get('/api/work-items?sort=priority&limit=5');
    expect(byPrio.body.items.every((i) => i.priority === 'critical')).toBe(true);
    const stats = await c.get('/api/work-items/stats');
    expect(stats.body.counts).toMatchObject({ open: 20, blocked: 5, in_progress: 0 });
    expect(stats.body.mine).toBe(12);
  });
  test('due=today / due=week / overdue return only matching ACTIVE items; stats agree', async () => {
    const w = await world();
    const d = new Date(); const day = (n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
    await h.makeItem(w.team, w.manager, { title: 'Due today item', dueDate: day(0) });
    await h.makeItem(w.team, w.manager, { title: 'Due in three days', dueDate: day(3) });
    await h.makeItem(w.team, w.manager, { title: 'Due next month', dueDate: day(30) });
    await h.makeItem(w.team, w.manager, { title: 'Late item', dueDate: day(-2) });
    await h.makeItem(w.team, w.manager, { title: 'Closed today', dueDate: day(0), status: 'closed' });
    const c = h.as(w.member);
    const titles = async (qs) => (await c.get(`/api/work-items?${qs}`)).body.items.map((i) => i.title).sort();
    expect(await titles('due=today')).toEqual(['Due today item']);
    expect(await titles('due=week')).toEqual(['Due in three days', 'Due today item']);
    expect(await titles('overdue=true')).toEqual(['Late item']);
    expect((await c.get('/api/work-items?due=month')).status).toBe(400);
    const st = (await c.get('/api/work-items/stats')).body;
    expect(st).toMatchObject({ dueToday: 1, dueWeek: 2, overdue: 1 });
  });
  test('invalid filters return 400 with a helpful message', async () => {
    const w = await world();
    const res = await h.as(w.member).get('/api/work-items?status=bogus&page=0');
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toBeDefined();
  });
  (process.env.SKIP_TEXT_SEARCH ? test.skip : test)('text search finds matching items', async () => {
    const w = await world();
    await h.makeItem(w.team, w.manager, { title: 'Chargeback dispute for Acme' });
    await h.makeItem(w.team, w.manager, { title: 'Reset password for customer' });
    const res = await h.as(w.member).get('/api/work-items?q=chargeback');
    expect(res.body.items.map((i) => i.title)).toEqual(['Chargeback dispute for Acme']);
  });
});
