import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { label } from '../ui';

export default function Profile() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [stats, setStats] = useState(null);
  useEffect(() => { api.teams().then((r) => setTeams(r.teams)).catch(() => {}); api.stats().then(setStats).catch(() => {}); }, []);
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Account</p>
      <h1>{user.name}</h1>
      <dl className="panel mt-6 grid gap-4 p-5 sm:grid-cols-2">
        <div><dt className="label">Email</dt><dd className="text-sm">{user.email}</dd></div>
        <div><dt className="label">Access level</dt><dd className="text-sm">{user.role === 'admin' ? 'Administrator' : 'Standard user'}</dd></div>
        {stats && <><div><dt className="label">Active items assigned to you</dt><dd className="tnum font-display text-2xl">{stats.mine}</dd></div><div><dt className="label">Overdue in your teams</dt><dd className="tnum font-display text-2xl">{stats.overdue}</dd></div></>}
      </dl>
      <h2 className="mt-8 text-xl">Team memberships</h2>
      <ul className="panel mt-3 divide-y divide-paper-300">
        {teams.length === 0 && <li className="p-4 text-sm text-ink-700">{user.role === 'admin' ? 'Administrators see all teams without needing membership.' : 'You are not on a team yet.'}</li>}
        {teams.map((t) => <li key={t.id} className="flex justify-between px-4 py-3 text-sm"><span>{t.name} <span className="text-ink-300">({t.key})</span></span><span className="text-ink-700">{t.myRole ? label(t.myRole) : 'Admin access'}</span></li>)}
      </ul>
      <p className="mt-6 text-xs text-ink-700">Profile editing is not available: the backend has no account-update endpoint yet.</p>
    </div>
  );
}
