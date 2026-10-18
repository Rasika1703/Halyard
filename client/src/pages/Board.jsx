import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, GripVertical } from 'lucide-react';
import { api } from '../api';
import { ErrorState, PriorityMark, STATUS, Skeleton, Spinner, fmtDate, isOverdue, label, useToast } from '../ui';

const COLS = ['open', 'in_progress', 'blocked', 'resolved', 'closed'];

export default function Board() {
  const toast = useToast();
  const [cols, setCols] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState({});
  const [over, setOver] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await Promise.all(COLS.map((s) => api.list({ status: s, limit: 50 })));
      setCols(Object.fromEntries(COLS.map((s, i) => [s, { items: r[i].items, total: r[i].total }]))); setError(null);
    } catch (e) { setError(e); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function drop(to, e) {
    e.preventDefault(); setOver('');
    const id = e.dataTransfer.getData('text/plain');
    const from = COLS.find((c) => cols[c].items.some((i) => i.id === id));
    if (!from || from === to) return;
    const item = cols[from].items.find((i) => i.id === id);
    const before = cols;
   
    setCols({ ...cols, [from]: { ...cols[from], items: cols[from].items.filter((i) => i.id !== id) }, [to]: { ...cols[to], items: [{ ...item, status: to }, ...cols[to].items] } });
    setPending((p) => ({ ...p, [id]: true }));
    try {
      await api.setStatus(id, { status: to, version: item.version });
      toast(`Moved to ${label(to)}`); load();
    } catch (x) { setCols(before); toast(x.message, 'error'); if (x.isConflict) load(); }
    finally { setPending((p) => { const n = { ...p }; delete n[id]; return n; }); }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Board</p>
      <h1 className="text-3xl">Work by status</h1>
      <p className="mt-1 text-sm text-ink-700">Drag a card to change its status. The server enforces workflow rules and permissions; rejected moves snap back with a reason.</p>
      {error ? <ErrorState error={error} onRetry={load} /> : !cols ? (
        <div className="mt-6 grid gap-3 md:grid-cols-5">{COLS.map((c) => <Skeleton key={c} className="h-72" />)}</div>
      ) : (
        <div className="mt-6 flex gap-3 overflow-x-auto pb-4 md:grid md:grid-cols-5 md:overflow-visible">
          {COLS.map((c) => (
            <section key={c} aria-label={STATUS[c].label} onDragOver={(e) => { e.preventDefault(); setOver(c); }} onDragLeave={() => setOver('')} onDrop={(e) => drop(c, e)}
              className={`min-w-[16rem] flex-1 rounded-lg border bg-paper-200/60 p-2 transition-colors ${over === c ? 'border-teal-500 bg-teal-50' : 'border-paper-300'}`}>
              <h2 className="flex items-center justify-between px-2 py-1.5 font-sans text-sm font-semibold"><span>{STATUS[c].label}</span><span className="text-xs font-normal text-ink-700">{cols[c].total}</span></h2>
              <ul className="space-y-2">
                {cols[c].items.map((i) => (
                  <li key={i.id} draggable={!pending[i.id]} onDragStart={(e) => e.dataTransfer.setData('text/plain', i.id)}
                    className={`fade-in rounded-md border border-paper-300 bg-paper-50 p-3 shadow-sm transition-shadow hover:shadow ${pending[i.id] ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'}`}>
                    <div className="flex items-start gap-1.5"><GripVertical size={14} className="mt-0.5 shrink-0 text-ink-300" aria-hidden />
                      <Link to={`/items/${i.id}`} className="text-sm font-medium leading-snug hover:text-teal-700">{i.title}</Link>{pending[i.id] && <Spinner className="ml-auto shrink-0" />}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-700">
                      <PriorityMark priority={i.priority} /><span>{i.team.key}</span>
                      {i.dueDate && <span className={`inline-flex items-center gap-1 ${isOverdue(i) ? 'font-semibold text-alert-600' : ''}`}><CalendarClock size={12} />{fmtDate(i.dueDate)}</span>}
                    </div>
                    <p className="mt-1.5 truncate text-xs">{i.assignee ? i.assignee.name : <span className="text-amber-600">Unassigned</span>}</p>
                  </li>))}
                {cols[c].items.length === 0 && <li className="px-2 py-6 text-center text-xs text-ink-300">Nothing here</li>}
              </ul>
              {cols[c].total > cols[c].items.length && <p className="px-2 pt-2 text-xs text-ink-700">Showing {cols[c].items.length} of {cols[c].total}. Use the command board to see more.</p>}
            </section>))}
        </div>
      )}
    </div>
  );
}
