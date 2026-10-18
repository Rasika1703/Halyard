import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, UserCog, User, Users } from 'lucide-react';
import { useAuth } from '../auth';
import { Field, Logo, Spinner } from '../ui';


const DEMO = [
  { email: 'admin@halyard.test', name: 'Ada Admin', role: 'Administrator', note: 'Teams, members, every item', Icon: ShieldCheck },
  { email: 'maya@halyard.test', name: 'Maya Manager', role: 'Manager', note: 'Payments Ops (manager), Support', Icon: UserCog },
  { email: 'omar@halyard.test', name: 'Omar Member', role: 'Member', note: 'Payments Ops only', Icon: User },
  { email: 'priya@halyard.test', name: 'Priya Platform', role: 'Manager', note: 'Platform Eng. (other team)', Icon: Users },
];
const DEMO_PASSWORD = 'halyard123';

export default function AuthPage() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function go(kind, fn) {
    setBusy(kind); setErr(null);
    try { await fn(); nav('/'); } catch (x) { setErr(x); } finally { setBusy(''); }
  }
  const submit = (e) => { e.preventDefault(); go('form', () => (mode === 'login' ? login({ email: f.email, password: f.password }) : register(f))); };
  const demo = (d) => { setMode('login'); setF({ ...f, email: d.email, password: DEMO_PASSWORD }); go(d.email, () => login({ email: d.email, password: DEMO_PASSWORD })); };

  return (
    <div className="aurora dark-surface grid min-h-screen text-paper-100 lg:grid-cols-[1.15fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-ink-900 p-14 text-paper-50 lg:flex">
        <svg className="pointer-events-none absolute -right-24 top-10 h-[34rem] w-[34rem] text-ink-700" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth=".6" aria-hidden>
          {[...Array(9)].map((_, i) => <path key={i} d={`M${40 + i * 8} 190V20l${70 - i * 4} 120H${40 + i * 8}`} opacity={1 - i * 0.1} />)}
        </svg>
        <Logo light />
        <div className="relative fade-in">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-500">Operations Command</p>
          <h1 className="mt-4 max-w-lg text-5xl font-semibold leading-[1.08]">Every request owned. Every change on record.</h1>
          <p className="mt-5 max-w-md text-ink-300">Halyard gives growing teams one place to raise work, take responsibility, resolve conflicts safely and see exactly what happened and why.</p>
          <ul className="mt-8 grid max-w-md gap-3 text-sm text-paper-200">
            {['One owner per item: simultaneous claims are resolved by the database', 'Stale edits are detected, never silently overwritten', 'Team-scoped access enforced on the server'].map((t) => (
              <li key={t} className="flex gap-3"><span className="mt-2 h-1 w-4 shrink-0 bg-teal-500" />{t}</li>))}
          </ul>
        </div>
        <p className="relative text-xs text-ink-300">Newtonite Engineering Challenge</p>
      </section>

      <section className="flex items-center justify-center px-6 py-10">
        <div className="fade-in w-full max-w-md space-y-7 rounded-2xl border border-white/10 bg-white/[.04] p-7 shadow-2xl backdrop-blur-xl">
          <div className="lg:hidden"><Logo light /></div>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <h2 className="text-3xl">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            {err && <p role="alert" className="rounded-md border border-alert-600/30 bg-alert-50 p-3 text-sm text-alert-600">
              {err.status === 401 && f.password === DEMO_PASSWORD ? 'Demo sign-in failed. The demo database may not be seeded yet: run `npm run seed -- --confirm-wipe` in /server on a disposable database.' : err.message}</p>}
            {mode === 'register' && <Field label="Name" htmlFor="name" error={err?.fields?.name}><input id="name" className="field" value={f.name} onChange={set('name')} autoComplete="name" /></Field>}
            <Field label="Email" htmlFor="email" error={err?.fields?.email}><input id="email" type="email" className="field" value={f.email} onChange={set('email')} autoComplete="email" /></Field>
            <Field label="Password" htmlFor="password" error={err?.fields?.password}>
              <div className="relative">
                <input id="password" type={show ? 'text' : 'password'} className="field pr-10" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1.5 rounded p-1 text-ink-700 hover:bg-paper-200">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </Field>
            <button className="btn-primary w-full active:scale-[.99]" disabled={!!busy}>{busy === 'form' && <Spinner />}{mode === 'login' ? 'Sign in' : 'Create account'}</button>
            <button type="button" className="w-full text-sm text-teal-700 hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(null); }}>
              {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}</button>
          </form>

          <div className="panel p-4">
            <h3 className="font-sans text-sm font-semibold">Explore demo workspace</h3>
            <p className="mt-1 text-xs text-ink-700">Sign in as a seeded demo user to see how roles change what you can do. Demo data only.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {DEMO.map((d) => (
                <button key={d.email} onClick={() => demo(d)} disabled={!!busy} className="flex items-start gap-2.5 rounded-md border border-paper-300 bg-white p-2.5 text-left transition-all hover:border-teal-500 hover:shadow-sm active:scale-[.99] disabled:opacity-50">
                  <span className="mt-0.5 rounded bg-teal-50 p-1.5 text-teal-700">{busy === d.email ? <Spinner /> : <d.Icon size={16} />}</span>
                  <span className="min-w-0"><span className="block text-sm font-medium">{d.role}</span><span className="block truncate text-xs text-ink-700">{d.name}</span><span className="block truncate text-[11px] text-ink-300">{d.note}</span></span>
                </button>))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
