import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import AttentionBoard from '../AttentionBoard';
import CreateItemModal from '../CreateItemModal';
import { Count, Empty, ErrorState, PriorityMark, Skeleton, StatusBadge, fmtDate, isOverdue, label, useToast } from '../ui';

const STATS = [['open', 'Open'], ['in_progress', 'In progress'], ['blocked', 'Blocked'], ['resolved', 'Resolved']];

export default function Dashboard({ view = 'overview' }) {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [teams, setTeams] = useState([]);
  const [stats, setStats] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState(sp.get('q') || '');
  const toast = useToast();

  const params = { ...(view === 'mine' ? { assignee: 'me' } : {}), ...Object.fromEntries(sp.entries()) };
  const set = (patch) => { const n = { ...params, ...patch }; if (!('page' in patch)) delete n.page; Object.keys(n).forEach((k) => !n[k] && delete n[k]); setSp(n); };

  useEffect(() => { api.teams().then((r) => setTeams(r.teams)).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(() => q !== (params.q || '') && set({ q }), 300); return () => clearTimeout(t); }, [q]); 

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [list, s] = await Promise.all([api.list({ limit: 15, ...params }), api.stats()]);
      setData(list); setStats(s);
    } catch (e) { setError(e); } finally { setLoading(false); }
  }, [sp]); 
  useEffect(() => { load(); }, [load]);

  const page = Number(params.page || 1);
  const filtered = ['q', 'status', 'priority', 'team', 'assignee', 'overdue', 'due'].some((k) => params[k]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">{view === 'mine' ? 'My Work' : view === 'all' ? 'All Work' : new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>{view === 'mine' ? 'Assigned to you' : view === 'all' ? 'Every work item' : `Good to see you, ${user.name.split(' ')[0]}`}</h1>
        </div>
        <button className="btn-primary" disabled={!teams.length} onClick={() => setCreating(true)} title={!teams.length ? 'Join a team first' : ''}><Plus size={16} />New item</button>
      </div>

      <section aria-label="Overview" className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-paper-300 bg-paper-300 md:grid-cols-6">
        {STATS.map(([k, l]) => (
          <button key={k} onClick={() => set({ status: k, overdue: '', due: '' })} className={`bg-paper-50 p-4 text-left transition-colors hover:bg-white ${params.status === k ? 'ring-2 ring-inset ring-teal-500' : ''}`}>
            <p className="text-xs text-ink-700">{l}</p>
            {stats ? <p className="font-display text-3xl"><Count n={stats.counts[k]} /></p> : <Skeleton className="mt-1 h-8 w-10" />}
          </button>
        ))}
        <button onClick={() => set({ assignee: 'me', status: '', overdue: '', due: '' })} className="bg-paper-50 p-4 text-left hover:bg-white">
          <p className="text-xs text-ink-700">Assigned to me</p>
          {stats ? <p className="font-display text-3xl"><Count n={stats.mine} /></p> : <Skeleton className="mt-1 h-8 w-10" />}
        </button>
        <button onClick={() => set({ overdue: 'true', status: '', due: '' })} className="bg-paper-50 p-4 text-left hover:bg-white">
          <p className="text-xs text-ink-700">Overdue</p>
          {stats ? <p className={`font-display text-3xl ${stats.overdue ? 'text-amber-600' : ''}`}><Count n={stats.overdue} /></p> : <Skeleton className="mt-1 h-8 w-10" />}
        </button>
      </section>

      {view === 'overview' && <AttentionBoard refreshKey={tick} />}

      <section className="mt-6 panel" aria-label="Work items">
        <div className="grid gap-2 border-b border-paper-300 p-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(5,1fr)]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search size={15} className="absolute left-3 top-2.5 text-ink-300" />
            <input aria-label="Search" className="field pl-9" placeholder="Search title or description" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select aria-label="Status" className="field" value={params.status || ''} onChange={(e) => set({ status: e.target.value, overdue: '', due: '' })}>
            <option value="">All statuses</option>{['open', 'in_progress', 'blocked', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
          <select aria-label="Priority" className="field" value={params.priority || ''} onChange={(e) => set({ priority: e.target.value })}>
            <option value="">Any priority</option><option value="high,critical">High &amp; critical</option>{['critical', 'high', 'medium', 'low'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
          <select aria-label="Team" className="field" value={params.team || ''} onChange={(e) => set({ team: e.target.value })}>
            <option value="">All teams</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select aria-label="Assignee" className="field" value={params.assignee || ''} onChange={(e) => set({ assignee: e.target.value })}>
            <option value="">Anyone</option><option value="me">Assigned to me</option><option value="unassigned">Unassigned</option>
          </select>
          <select aria-label="Sort" className="field" value={`${params.sort || 'updated'}`} onChange={(e) => set({ sort: e.target.value })}>
            <option value="updated">Recently updated</option><option value="priority">Highest priority</option><option value="created">Newest</option>
          </select>
        </div>
        {filtered && <div className="border-b border-paper-300 px-3 py-2 text-xs"><button className="text-teal-700 hover:underline" onClick={() => { setQ(''); setSp({}); }}>Clear all filters</button></div>}

        {error ? <ErrorState error={error} onRetry={load} /> : loading && !data ? (
          <div className="space-y-2 p-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : data.items.length === 0 ? (
          filtered ? <Empty title="Nothing matches those filters" hint="Try a broader search or clear the filters." action={<button className="btn-ghost" onClick={() => { setQ(''); setSp({}); }}>Clear filters</button>} />
            : teams.length === 0 ? <Empty title="You are not on a team yet" hint="Ask an administrator to add you to a team. Work items are shared within teams." />
            : <Empty title="No work items yet" hint="Create the first one to start tracking operational work." action={<button className="btn-primary" onClick={() => setCreating(true)}>New item</button>} />
        ) : (
          <ul className={`divide-y divide-paper-300 ${loading ? 'opacity-60' : ''}`}>
            {data.items.map((i) => (
              <li key={i.id}>
                <Link to={`/items/${i.id}`} className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-white sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.title}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-700">{i.team.key} · {label(i.category)} · {i.assignee ? i.assignee.name : <span className="text-amber-600">Unassigned</span>}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:w-72 sm:justify-end">
                    {i.dueDate && <span className={`inline-flex items-center gap-1 text-xs ${isOverdue(i) ? 'font-semibold text-alert-600' : 'text-ink-700'}`}><CalendarClock size={13} />{fmtDate(i.dueDate)}</span>}
                    <PriorityMark priority={i.priority} /><StatusBadge status={i.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {data && data.total > 0 && (
          <div className="flex items-center justify-between border-t border-paper-300 px-4 py-2.5 text-xs text-ink-700">
            <span>{data.total} item{data.total === 1 ? '' : 's'} · page {data.page} of {data.pages}</span>
            <span className="flex gap-1">
              <button className="btn-ghost !px-2 !py-1" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })} aria-label="Previous page"><ChevronLeft size={14} /></button>
              <button className="btn-ghost !px-2 !py-1" disabled={page >= data.pages} onClick={() => set({ page: String(page + 1) })} aria-label="Next page"><ChevronRight size={14} /></button>
            </span>
          </div>
        )}
      </section>
      {creating && <CreateItemModal teams={teams} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setTick((t) => t + 1); load(); }} />}
    </div>
  );
}
