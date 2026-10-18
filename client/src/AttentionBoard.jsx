import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CalendarClock } from 'lucide-react';
import { api } from './api';
import { PriorityMark, Skeleton, fmtDate, isOverdue } from './ui';


const PANELS = [
  { key: 'overdue', title: 'Overdue', hint: 'Past due and not finished', q: { overdue: 'true', sort: 'priority' }, to: '/work?overdue=true', span: 'lg:col-span-3', tone: 'bg-alert-600', empty: 'Nothing is overdue.' },
  { key: 'blocked', title: 'Blocked', hint: 'Waiting on something', q: { status: 'blocked', sort: 'priority' }, to: '/work?status=blocked', span: 'lg:col-span-3', tone: 'bg-amber-500', empty: 'Nothing is blocked.' },
  { key: 'risk', title: 'At risk', hint: 'High priority, due within a week', q: { due: 'week', priority: 'high,critical' }, to: '/work?due=week&priority=high,critical', span: 'lg:col-span-2', tone: 'bg-amber-500', empty: 'No urgent work due this week.' },
  { key: 'mine', title: 'Yours', hint: 'Assigned to you, still active', q: { assignee: 'me', status: 'open,in_progress,blocked', sort: 'priority' }, to: '/my-work', span: 'lg:col-span-2', tone: 'bg-gold-500', empty: 'You have nothing assigned.' },
  { key: 'recent', title: 'Recently changed', hint: 'Last items touched in your teams', q: { sort: 'updated' }, to: '/work', span: 'lg:col-span-2', tone: 'bg-steel-500', empty: 'No activity yet.' },
];

export default function AttentionBoard({ refreshKey }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let live = true;
    setErr(null);
    Promise.all(PANELS.map((p) => api.list({ limit: 4, ...p.q }))).then((r) => live && setData(r)).catch((e) => live && setErr(e));
    return () => { live = false; };
  }, [refreshKey]);

  if (err) return <p role="alert" className="mt-6 rounded-md bg-alert-50 p-3 text-sm text-alert-600">Could not load the attention board: {err.message}</p>;
  return (
    <section aria-label="Needs attention" className="mt-6 grid gap-3 lg:grid-cols-6">
      {PANELS.map((p, i) => {
        const r = data?.[i];
        return (
          <div key={p.key} className={`panel relative overflow-hidden ${p.span}`}>
            <span className={`absolute inset-y-0 left-0 w-0.5 ${p.tone}`} aria-hidden />
            <div className="flex items-baseline justify-between px-4 pb-2 pt-3.5">
              <div><h2 className="text-base">{p.title}</h2><p className="text-xs text-ink-700">{p.hint}</p></div>
              <Link to={p.to} className="text-xs font-medium text-ink-900 underline-offset-4 hover:underline">{r ? `View all ${r.total}` : ''}</Link>
            </div>
            {!r ? <div className="space-y-2 px-4 pb-4">{[0, 1, 2].map((n) => <Skeleton key={n} className="h-9" />)}</div>
              : r.items.length === 0 ? <p className="flex items-center gap-2 px-4 pb-4 pt-1 text-sm text-ink-700"><CheckCircle2 size={15} className="text-ok-500" aria-hidden />{p.empty}</p>
              : <ul className="divide-y divide-paper-300/70 border-t border-paper-300/70">
                {r.items.map((it) => (
                  <li key={it.id}><Link to={`/items/${it.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-paper-100">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{it.title}</span>
                      <span className="block truncate text-xs text-ink-700">{it.team.key} · {it.assignee ? it.assignee.name : 'Unassigned'}</span></span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <PriorityMark priority={it.priority} />
                      {it.dueDate && <span className={`inline-flex items-center gap-1 text-[11px] ${isOverdue(it) ? 'font-semibold text-alert-600' : 'text-ink-700'}`}><CalendarClock size={11} aria-hidden />{fmtDate(it.dueDate)}</span>}
                    </span></Link></li>))}
              </ul>}
          </div>);
      })}
    </section>
  );
}
