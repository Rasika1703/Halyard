# Engineering Decisions — Halyard

Halyard is an internal operations tracker (React + Express + MongoDB). These are the five decisions that shaped it.

## 1. Data model: one `WorkItem` document, with comments and history in separate collections
**Problem.** Items accumulate unbounded history (comments, state changes), and the list view must stay fast with tens of thousands of items.
**Approach.** `WorkItem` holds current state only (status, priority, assignee, team, `version`). `Comment` and `ActivityLog` are separate collections keyed by `workItem`, indexed `{workItem, createdAt}` and paginated. `ActivityLog` is append-only. `priorityRank` is a denormalised number so priority sorting happens in the database.
**Why.** Embedding history would make every item document grow forever and every list query heavier. Separate collections keep hot documents small and let history be paged.
**Alternative.** Embedded arrays (simpler reads, one fewer query) or event sourcing (perfect audit, much more machinery).
**Trade-off.** The state change and its activity row are two writes, not one transaction. A crash between them could lose a history row for a change that did apply. A transaction (needs a replica set; Atlas has one) or an outbox would close that gap.

## 2. Authorization: global role + per-team role, derived per request, enforced on the server
**Problem.** "Not every user can do every action", and IDs must not be guessable into other teams' data.
**Approach.** Users have a global role (`admin`/`user`) and per-team memberships (`manager`/`member`). One function (`services/access.js`) computes permissions from `(user, item.team)`. The user is re-loaded from the database on every request, so removing a membership takes effect immediately. Items outside the caller's teams return **404, not 403**, so existence is not leaked. List queries are scoped by team in the database query itself. The UI only hides controls as a convenience.
**Why.** Team-scoped roles match the brief ("different responsibilities within teams") without a full policy engine.
**Alternative.** Embedding roles in the JWT (saves a lookup, but stale until expiry) or a policy library such as CASL.
**Trade-off.** One extra user lookup per request. Permissions are code, not data, so they cannot be edited at runtime.
**Token storage.** JWT in an `HttpOnly` cookie (invisible to XSS). Production uses a Vercel rewrite so `/api` is same-origin and `SameSite=Lax` is enough; mutating requests also need a custom `X-Requested-With` header as a CSRF guard. Limitation: no refresh tokens or server-side revocation; sessions last 8 hours.

## 3. Concurrency: atomic claim + optimistic versioning
**Problem.** Two people claim the same item; one edits an item that someone else just changed.
**Approach.**
- *Claim* is a single `findOneAndUpdate({_id, assignee: null, status: 'open'}, {$set…, $inc: {version: 1}})`. The condition and the write are one atomic operation; a `null` result means someone else won, and the API returns **409 `ALREADY_CLAIMED`** with the current item.
- *Edit/status/assign* carry the `version` the client saw. The write filter includes `version`, so it only applies if nothing changed. Otherwise **409 `STALE_UPDATE`** with `yourVersion`, `currentVersion` and the current item. The UI replaces its state with the server's item and explains what happened; drafts stay in the form.
**Why.** Both need no locks, no extra collections and scale across server instances, because the database arbitrates.
**Alternative.** Pessimistic locks/leases (block people, need expiry handling) or last-write-wins (silently loses data).
**Trade-off.** The user must resolve a conflict manually; there is no field-level merge. Comments do not bump `version` on purpose, so discussion never causes edit conflicts.

## 4. Duplicate submissions: server-side idempotency keys with a pre-allocated ID
**Problem.** Double-clicks and network retries must not create duplicate items.
**Approach.** `POST /work-items` requires an `Idempotency-Key`. A record `{user, key}` (unique index, 24h TTL) is upserted and **pre-allocates the new item's `_id`**. Whoever inserts that `_id` first wins; any retry or truly simultaneous duplicate hits the duplicate-key error and replays the original item (`200` + `Idempotent-Replayed: true`). The same key with a different body is rejected (`422`). The client generates one key per distinct payload, so retries reuse it and edits get a new one.
**Why.** Relying on the primary-key uniqueness of the item itself removes the "record says pending but the item was never written" failure mode, with no cleanup job.
**Alternative.** Disabling the button only (not protection against retries), or a content-hash dedupe (would block legitimately identical items).
**Trade-off.** Only creation is idempotent. Other mutations are protected by version checks instead (a repeated stale request just gets 409).

## 5. Synchronous by default; no background jobs (deliberately)
**Problem.** The brief invites asynchronous work (notifications, enrichment) but requires thinking about failure, duplicates and delay.
**Approach.** Everything user-visible, including the audit trail, runs inside the request. I did **not** build a queue or notifications.
**Why.** For a one-day scope, a half-built queue would add failure modes (lost jobs, double delivery) without strengthening the core correctness story. The write paths are small and fast.
**Alternative.** An outbox collection polled by a worker, with idempotent consumers keyed by `activity._id`. This is the first thing I would add: the append-only `ActivityLog` is already the natural outbox source.
**Trade-off.** No notifications; list pagination uses skip/limit (fine at tens of thousands of rows, would move to keyset pagination for deep paging).
