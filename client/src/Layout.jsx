import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutGrid, ListChecks, Table2, Columns3, Shield, UserCircle, LogOut, Menu, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from './auth';
import { Logo } from './ui';
import CommandPalette from './CommandPalette';

const initials = (n) => n.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('halyard.nav') === '1');
  const loc = useLocation();
  const toggle = () => setCollapsed((c) => { localStorage.setItem('halyard.nav', c ? '0' : '1'); return !c; });

  const sections = [
    { title: 'Workspace', items: [
      { to: '/', end: true, Icon: LayoutGrid, text: 'Overview' },
      { to: '/my-work', Icon: ListChecks, text: 'My Work' },
      { to: '/work', Icon: Table2, text: 'All Work' },
      { to: '/board', Icon: Columns3, text: 'Kanban Board' },
    ] },
    ...(user.role === 'admin' ? [{ title: 'Administration', items: [{ to: '/admin', Icon: Shield, text: 'Teams & people' }] }] : []),
    { title: 'Account', items: [{ to: '/profile', Icon: UserCircle, text: 'Profile' }] },
  ];
  const link = (small) => ({ isActive }) => `group relative flex items-center gap-3 rounded-md py-2 text-sm transition-colors duration-150 ${small ? 'justify-center px-2' : 'px-3'} ${isActive ? 'bg-ink-800 text-white before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded before:bg-teal-500' : 'text-ink-300 hover:bg-ink-800/60 hover:text-white'}`;

  const nav = (small) => (
    <>
      <nav className="mt-7 flex flex-1 flex-col gap-5" aria-label="Main" onClick={() => setOpen(false)}>
        {sections.map((s) => (
          <div key={s.title}>
            {!small && <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-300/70">{s.title}</p>}
            <div className="flex flex-col gap-0.5">
              {s.items.map(({ to, end, Icon, text }) => (
                <NavLink key={to} to={to} end={end} className={link(small)} title={small ? text : undefined} aria-label={text}>
                  <Icon size={17} className="shrink-0" />{!small && <span>{text}</span>}
                </NavLink>))}
            </div>
          </div>))}
      </nav>
      <div className="border-t border-white/10 pt-4">
        <div className={`flex items-center gap-3 ${small ? 'justify-center' : ''}`}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-600 text-xs font-semibold text-white" aria-hidden>{initials(user.name)}</span>
          {!small && <div className="min-w-0"><p className="truncate text-sm font-medium text-paper-100">{user.name}</p><p className="truncate text-xs text-ink-300">{user.role === 'admin' ? 'Administrator' : user.email}</p></div>}
        </div>
        <button onClick={logout} title="Sign out" aria-label="Sign out" className={`mt-3 flex items-center gap-2 text-xs text-ink-300 hover:text-white ${small ? 'mx-auto' : ''}`}><LogOut size={14} />{!small && 'Sign out'}</button>
      </div>
    </>
  );
  return (
    <div className="min-h-screen lg:flex">
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-ink-900 p-4 transition-[width] duration-200 lg:flex ${collapsed ? 'w-[4.5rem]' : 'w-64'}`}>
        <div className={`flex items-center ${collapsed ? 'flex-col gap-3' : 'justify-between'}`}><Logo light compact={collapsed} />
          <button onClick={toggle} className="rounded p-1.5 text-ink-300 hover:bg-ink-800 hover:text-white" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button></div>
        {nav(collapsed)}
      </aside>
      <header className="flex items-center justify-between bg-ink-900 px-4 py-3 lg:hidden">
        <Logo light />
        <button className="rounded p-1.5 text-paper-100" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      </header>
      {open && <div className="fade-in flex flex-col bg-ink-900 px-5 pb-5 lg:hidden">{nav(false)}</div>}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10"><CommandPalette />
        <div className="mb-4 hidden justify-end text-xs text-ink-700 lg:flex"><kbd className="rounded border border-paper-300 bg-paper-50 px-2 py-1">Ctrl / ⌘ K</kbd><span className="ml-2 self-center">Jump anywhere</span></div><div key={loc.pathname} className="page-in"><Outlet /></div></main>
    </div>
  );
}
