import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft } from 'lucide-react';
import { useAuth } from './auth';

export default function CommandPalette() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const input = useRef(null);

  useEffect(() => { 
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { if (open) { setQ(''); setI(0); setTimeout(() => input.current?.focus(), 0); } }, [open]);

  const cmds = useMemo(() => [
    ['Overview', '/'], ['My work', '/my-work'], ['All work', '/work'], ['Kanban board', '/board'], ['Profile', '/profile'],
    ['Work due today', '/work?due=today'], ['Work due this week', '/work?due=week'], ['Overdue work', '/work?overdue=true'],
    ['High and critical priority', '/work?priority=high,critical'], ['Blocked work', '/work?status=blocked'],
    ...(user.role === 'admin' ? [['Teams & people (admin)', '/admin']] : []),
  ].map(([label, to]) => ({ label, to })), [user.role]);
  const shown = cmds.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
  const go = (c) => { if (c) { nav(c.to); setOpen(false); } };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/60 p-4 pt-[15vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="fade-in w-full max-w-lg overflow-hidden rounded-xl border border-paper-300 bg-paper-50 shadow-2xl"
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, shown.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
          if (e.key === 'Enter') go(shown[i]);
        }}>
        <div className="flex items-center gap-2 border-b border-paper-300 px-4"><Search size={16} className="text-ink-300" />
          <input ref={input} aria-label="Search commands" className="h-12 flex-1 bg-transparent text-sm outline-none" placeholder="Jump to a page or filter…" value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} /></div>
        <ul role="listbox" className="max-h-72 overflow-y-auto p-1.5">
          {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-700">No matching commands</li>}
          {shown.map((c, n) => (
            <li key={c.to} role="option" aria-selected={n === i} onMouseEnter={() => setI(n)} onClick={() => go(c)}
              className={`flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm ${n === i ? 'bg-ink-900 text-white' : ''}`}>{c.label}{n === i && <CornerDownLeft size={14} />}</li>))}
        </ul>
      </div>
    </div>
  );
}
