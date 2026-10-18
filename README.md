Halyard

A small internal tool for tracking operational work: requests come in, someone takes ownership, people discuss it, and the history stays on record. I built it for the Newtonite engineering challenge.

Stack: React 18 (Vite, Tailwind, React Router), Express, MongoDB via Mongoose. Auth is a JWT in an HttpOnly cookie. Tests are Jest + Supertest on the server and Vitest + Testing Library on the client.

What it does

Users sign in, belong to one or more teams, and create work items for those teams. An item has a status, priority, optional due date, an assignee, comments, and an activity history. Admins manage teams and memberships.

Pages: / overview, /my-work, /work (search, filters, sorting, pagination), /board (drag cards between statuses), /items/:id, /profile, /admin. Ctrl/Cmd+K opens a quick-jump palette.

The overview shows what needs attention: overdue, blocked, at-risk (high priority and due within a week), yours, and recently changed. Each panel is a real filtered query, not a client-side slice.

The parts I spent the most time on
Claiming. Taking an unassigned item is one atomic findOneAndUpdate with the "still unassigned" condition in the filter. If two people click at once, one wins and the other gets a 409 with the current owner.
Stale edits. Every item carries a version. Edits, status changes and assignments send the version they saw, and the update only applies if it still matches. Otherwise the server returns 409 with the latest item and the UI shows what changed.
Duplicate submits. Creating an item needs an Idempotency-Key header. A retry with the same key returns the original item instead of making a second one.
Permissions. Checked on the server for every route. Someone outside an item's team gets a 404, so ids can't be probed. Only managers can assign work or close items.
Workflow. Allowed moves are open → in_progress ⇄ blocked → resolved → closed. You need an assignee to start or resolve, and only a manager can close or reopen.

ENGINEERING_DECISIONS.md explains the reasoning and the trade-offs.

Running it locally

You need Node 18+ and a MongoDB database (an Atlas free cluster works).

bash
cd server
cp .env.example .env      # set MONGODB_URI and JWT_SECRET
npm install
npm run seed -- --confirm-wipe
npm run dev               # API on :4000

cd ../client
npm install
npm run dev               # app on :5173, proxies /api to :4000

The seed script deletes every user, team, item, comment and activity record in the database it points at, so it refuses to run without --confirm-wipe. Only use it on a throwaway demo database. It then creates three teams, four users and 40 items spread across every status, with some blocked and overdue.

Demo logins, all with password halyard123:

admin@halyard.test (admin)
maya@halyard.test (manager of Payments Ops, member of Support)
omar@halyard.test (member of Payments Ops)
priya@halyard.test (manager of Platform Engineering)

The login page has buttons for these. A newly registered user has no team until an admin adds them.

Tests
bash
cd server && npm test
cd client && npm test

The server tests use mongodb-memory-server, or set TEST_MONGODB_URI to use your own MongoDB. They cover auth, team isolation, validation, workflow rules, the claim/version/idempotency cases, history, filters and pagination.

Deploying
Atlas: create a free cluster and a database user, and allow network access from Render (or 0.0.0.0/0 for a short demo).
Render: a web service rooted at server, build npm install, start npm start. Set MONGODB_URI, JWT_SECRET, NODE_ENV=production and CLIENT_ORIGINS to your Vercel URL.
Vercel: root client, Vite preset. In client/vercel.json, replace YOUR-RENDER-SERVICE with your Render host. The rewrite keeps /api on the same origin so the cookie works. The free Render tier sleeps, so the first request can take around 30 seconds.
What I have and haven't verified

I ran the client build and the client tests (3 passing). I ran the server suite against FerretDB, a MongoDB-compatible emulator, because I couldn't get a real mongod in my environment. 33 tests passed and 3 were skipped.

Two of the skipped tests are the concurrency ones (10 simultaneous claims, 2 simultaneous edits). FerretDB's SQLite backend isn't atomic under parallel updates, which I confirmed with the plain driver, so those tests can't mean anything there. Real MongoDB does guarantee this, but until you run npm test against Atlas or a real mongod they are unproven. The third skipped test is text search, which FerretDB doesn't support.

Not done: looking at the UI in a real browser, deploying, load testing, and running the seed script.

Known gaps
No notifications or background jobs. Everything happens inside the request.
An item change and its history row are two separate writes, not one transaction.
Pagination uses skip/limit, which is fine for tens of thousands of rows but not for very deep pages.
The Overview's "recently changed" shows recently updated items, because there's no cross-team activity endpoint yet. There are also no analytics, calendar or people pages.
No password reset, email verification, refresh tokens or session revocation.
The admin page only creates teams and sets memberships. It can't list or remove users.
Dates use UTC day boundaries for "due today" and "overdue".
The item page refetches when you return to the tab. There are no live updates.
Styling tokens (colors and fonts) are all in client/tailwind.config.js.