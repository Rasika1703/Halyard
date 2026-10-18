import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Hand, RefreshCw, Pencil, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { Empty, ErrorState, Field, PriorityMark, Skeleton, Spinner, StatusBadge, fmtDate, fmtTime, isOverdue, label, useToast, CATEGORIES } from '../ui';

const NEXT = { open: ['in_progress', 'blocked'], in_progress: ['blocked', 'resolved', 'open'], blocked: ['in_progress', 'open'], resolved: ['closed', 'in_progress'], closed: [] };
const VERB = { in_progress: 'Start work', blocked: 'Mark blocked', resolved: 'Resolve', open: 'Move to open', closed: 'Close item' };

function describe(a) {
  const d = a.data || {};
  switch (a.type) {
    case 'created': return 'created this item';
    case 'claimed': return 'took responsibility for this item';
    case 'assigned': return d.fromName ? `reassigned this item (was ${d.fromName})` : 'assigned this item';
    case 'unassigned': return 'removed the assignee';
    case 'status_changed': return `changed status from ${label(d.from)} to ${label(d.to)}`;
    case 'priority_changed': return `changed priority from ${label(d.from)} to ${label(d.to)}`;
    case 'edited': return `edited ${Object.keys(d).join(', ')}`;
    case 'commented': return 'commented';
    default: return a.type;
  }
}

export default function ItemDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [item, setItem] = useState(null);
  const [perm, setPerm] = useState({});
  const [members, setMembers] = useState([]);
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [fieldErr, setFieldErr] = useState({});
  const [comment, setComment] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const r = await api.get(id);
      setItem(r.item); setPerm(r.permissions); setError(null);
      const [c, a] = await Promise.all([api.comments(id), api.activity(id)]);
      setComments(c.comments); setActivity(a.activity);
      if (r.permissions.assign) api.members(r.item.team._id).then((m) => setMembers(m.members)).catch(() => {});
    } catch (e) { setError(e); }
  }, [id]);
  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { const f = () => document.visibilityState === 'visible' && !editing && loadAll(); document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, [loadAll, editing]);

 
  async function run(name, fn, okMsg) {
    setBusy(name); setConflict(null); setFieldErr({});
    try {
      const r = await fn();
      setItem(r.item); setEditing(false);
      if (okMsg) toast(okMsg);
      api.activity(id).then((a) => setActivity(a.activity));
      return true;
    } catch (e) {
      if (e.isConflict && e.details?.current) { setConflict(e); setItem(e.details.current); api.activity(id).then((a) => setActivity(a.activity)); }
      else if (e.fields && Object.keys(e.fields).length) setFieldErr(e.fields);
      else toast(e.message, 'error');
      return false;
    } finally { setBusy(''); }
  }

  if (error) return <div className="mx-auto max-w-3xl"><BackLink />{error.status === 404 ? <Empty title="Work item not found" hint="It may not exist, or you may not have access to its team." /> : <ErrorState error={error} onRetry={loadAll} />}</div>;
  if (!item) return <div className="mx-auto max-w-5xl space-y-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;

  const closed = item.status === 'closed';
  const startEdit = () => { setDraft({ title: item.title, description: item.description, category: item.category, priority: item.priority, dueDate: item.dueDate ? item.dueDate.slice(0, 10) : '' }); setEditing(true); setConflict(null); };
  const save = (e) => { e.preventDefault(); run('save', () => api.update(id, { ...draft, dueDate: draft.dueDate || null, version: item.version }), 'Changes saved'); };

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink />
      {conflict && (
        <div role="alert" className="fade-in mb-4 flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-50 p-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="flex-1"><p className="font-semibold">{conflict.code === 'ALREADY_CLAIMED' ? 'Someone got there first' : 'This item changed while you were working'}</p>
            <p className="text-ink-800">{conflict.message} The latest version is now shown{editing ? '; your unsaved edits are still in the form below' : ''}.</p></div>
          <button className="text-xs underline" onClick={() => setConflict(null)}>Dismiss</button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <section className="panel p-5">
            <div className="flex flex-wrap items-center gap-3"><StatusBadge status={item.status} /><PriorityMark priority={item.priority} /><span className="text-xs text-ink-700">{item.team.name} · {label(item.category)}</span></div>
            {editing ? (
              <form onSubmit={save} className="mt-4 space-y-3" noValidate>
                <Field label="Title" htmlFor="e-title" error={fieldErr.title}><input id="e-title" className="field" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
                <Field label="Description" htmlFor="e-desc"><textarea id="e-desc" rows={5} className="field" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Category" htmlFor="e-cat"><select id="e-cat" className="field" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></Field>
                  <Field label="Priority" htmlFor="e-prio"><select id="e-prio" className="field" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>{['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{label(p)}</option>)}</select></Field>
                  <Field label="Due date" htmlFor="e-due"><input id="e-due" type="date" className="field" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} /></Field>
                </div>
                <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button><button className="btn-primary" disabled={busy === 'save'}>{busy === 'save' && <Spinner />}Save changes</button></div>
              </form>
            ) : (
              <>
                <div className="mt-3 flex items-start justify-between gap-3"><h1 className="text-2xl leading-snug">{item.title}</h1>
                  {perm.edit && !closed && <button className="btn-ghost shrink-0" onClick={startEdit}><Pencil size={14} />Edit</button>}</div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-800">{item.description || <span className="text-ink-300">No description provided.</span>}</p>
              </>
            )}
          </section>

          <section className="panel p-5" aria-label="Discussion">
            <h2 className="text-lg">Discussion</h2>
            {perm.comment && (
              <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!comment.trim()) return; setBusy('comment');
                try { const r = await api.addComment(id, comment); setComments([r.comment, ...comments]); setComment(''); api.activity(id).then((a) => setActivity(a.activity)); } catch (x) { toast(x.message, 'error'); } finally { setBusy(''); } }}>
                <input aria-label="Add a comment" className="field" placeholder="Add a comment" value={comment} onChange={(e) => setComment(e.target.value)} />
                <button className="btn-primary" disabled={busy === 'comment' || !comment.trim()}>Post</button>
              </form>
            )}
            <ul className="mt-4 space-y-3">
              {comments.length === 0 && <li className="text-sm text-ink-700">No comments yet.</li>}
              {comments.map((c) => <li key={c.id} className="rounded-md bg-white p-3 text-sm"><p className="text-xs text-ink-700"><b className="text-ink-900">{c.author?.name}</b> · {fmtTime(c.createdAt)}</p><p className="mt-1 whitespace-pre-wrap">{c.body}</p></li>)}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="panel p-4">
            <h2 className="text-base">Ownership</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="label">Assignee</dt><dd>{item.assignee ? item.assignee.name : <span className="text-amber-600">Unassigned</span>}</dd></div>
              <div><dt className="label">Created by</dt><dd>{item.creator.name}</dd></div>
              <div><dt className="label">Due</dt><dd className={isOverdue(item) ? 'font-semibold text-alert-600' : ''}>{item.dueDate ? fmtDate(item.dueDate) : 'No due date'}{isOverdue(item) && ' · overdue'}</dd></div>
              <div><dt className="label">Updated</dt><dd>{fmtTime(item.updatedAt)} <span className="text-ink-300">· v{item.version}</span></dd></div>
            </dl>
            {!item.assignee && item.status === 'open' && perm.claim && (
              <button className="btn-primary mt-4 w-full" disabled={!!busy} onClick={() => run('claim', () => api.claim(id), 'You now own this item')}>{busy === 'claim' ? <Spinner /> : <Hand size={15} />}Take responsibility</button>
            )}
            {perm.assign && !closed && (
              <div className="mt-4"><label className="label" htmlFor="assign">Assign to</label>
                <select id="assign" className="field" value={item.assignee?._id || ''} disabled={!!busy}
                  onChange={(e) => run('assign', () => api.assign(id, { assigneeId: e.target.value || null, version: item.version }), 'Assignment updated')}>
                  <option value="">Unassigned</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                </select></div>
            )}
          </section>

          {!closed && (
            <section className="panel p-4"><h2 className="text-base">Next step</h2>
              <div className="mt-3 flex flex-col gap-2">
                {NEXT[item.status].map((s) => (
                  <button key={s} className={s === 'resolved' ? 'btn-primary' : 'btn-ghost'} disabled={!!busy}
                    onClick={() => run('st-' + s, () => api.setStatus(id, { status: s, version: item.version }), `Status: ${label(s)}`)}>{busy === 'st-' + s && <Spinner />}{VERB[s]}</button>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-700">The server enforces who may do what; unavailable actions are rejected with an explanation.</p>
            </section>
          )}
          {closed && perm.manage && <section className="panel p-4"><button className="btn-ghost w-full" onClick={() => run('reopen', () => api.setStatus(id, { status: 'open', version: item.version }), 'Item reopened')}><RefreshCw size={14} />Reopen</button></section>}

          <section className="panel p-4" aria-label="Activity history">
            <h2 className="text-base">History</h2>
            <ol className="mt-3 space-y-3 border-l border-paper-300 pl-4">
              {activity.map((a) => (
                <li key={a.id} className="relative text-sm"><span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-teal-500" />
                  <p><b>{a.actor?.name}</b> {describe(a)}</p><p className="text-xs text-ink-700">{fmtTime(a.createdAt)}</p></li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
const BackLink = () => <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink-900"><ArrowLeft size={15} />Overview</Link>;
