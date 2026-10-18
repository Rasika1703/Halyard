import { useEffect, useState } from 'react';
import { api } from '../api';
import { Field, Spinner, label, useToast } from '../ui';

export default function Admin() {
  const toast = useToast();
  const [teams, setTeams] = useState([]);
  const [t, setT] = useState({ name: '', key: '' });
  const [m, setM] = useState({ team: '', email: '', role: 'member' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const load = () => api.teams().then((r) => { setTeams(r.teams); setM((x) => ({ ...x, team: x.team || r.teams[0]?.id || '' })); });
  useEffect(() => { load(); }, []);

  const act = async (fn, msg, reset) => { setBusy(true); setErr({}); try { await fn(); toast(msg); reset?.(); load(); } catch (e) { setErr(e.fields || {}); toast(e.message, 'error'); } finally { setBusy(false); } };
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Administration</p>
      <h1 className="text-3xl">Teams &amp; people</h1>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <form className="panel space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); act(() => api.createTeam(t), 'Team created', () => setT({ name: '', key: '' })); }}>
          <h2 className="text-lg">Create team</h2>
          <Field label="Name" htmlFor="tn" error={err.name}><input id="tn" className="field" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></Field>
          <Field label="Short key (2–6 letters)" htmlFor="tk" error={err.key}><input id="tk" className="field uppercase" value={t.key} onChange={(e) => setT({ ...t, key: e.target.value })} /></Field>
          <button className="btn-primary" disabled={busy}>{busy && <Spinner />}Create team</button>
        </form>
        <form className="panel space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); act(() => api.addMember(m.team, { email: m.email, role: m.role }), 'Membership saved', () => setM({ ...m, email: '' })); }}>
          <h2 className="text-lg">Add or update a member</h2>
          <Field label="Team" htmlFor="mt"><select id="mt" className="field" value={m.team} onChange={(e) => setM({ ...m, team: e.target.value })}>{teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="User email" htmlFor="me" error={err.email}><input id="me" type="email" className="field" value={m.email} onChange={(e) => setM({ ...m, email: e.target.value })} /></Field>
          <Field label="Role in team" htmlFor="mr"><select id="mr" className="field" value={m.role} onChange={(e) => setM({ ...m, role: e.target.value })}>{['member', 'manager'].map((r) => <option key={r} value={r}>{label(r)}</option>)}</select></Field>
          <button className="btn-primary" disabled={busy || !m.team}>{busy && <Spinner />}Save membership</button>
        </form>
      </div>
      <ul className="panel mt-6 divide-y divide-paper-300">{teams.map((x) => <li key={x.id} className="flex justify-between px-4 py-3 text-sm"><span>{x.name}</span><span className="text-ink-700">{x.key}</span></li>)}</ul>
    </div>
  );
}
