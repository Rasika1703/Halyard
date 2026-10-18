import { useRef, useState } from 'react';
import { api } from './api';
import { CATEGORIES, Field, Modal, Spinner, label, useToast } from './ui';

export default function CreateItemModal({ teams, onClose, onCreated }) {
  const toast = useToast();
  const [f, setF] = useState({ title: '', description: '', category: 'task', priority: 'medium', team: teams[0]?.id || '', dueDate: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const keyRef = useRef({ payload: '', key: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const payload = { ...f, dueDate: f.dueDate || null };
    const sig = JSON.stringify(payload);
    if (keyRef.current.payload !== sig) keyRef.current = { payload: sig, key: crypto.randomUUID() };
    setBusy(true); setErr(null);
    try {
      const { item } = await api.create(payload, keyRef.current.key);
      toast('Work item created');
      onCreated(item);
    } catch (x) { setErr(x); } finally { setBusy(false); }
  }
  const E = err?.fields || {};
  return (
    <Modal title="New work item" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        {err && !Object.keys(E).length && <p role="alert" className="rounded-md bg-alert-50 p-3 text-sm text-alert-600">{err.message}</p>}
        <Field label="Title" htmlFor="c-title" error={E.title}><input id="c-title" className="field" value={f.title} onChange={set('title')} autoFocus /></Field>
        <Field label="Description" htmlFor="c-desc" error={E.description}><textarea id="c-desc" rows={4} className="field" value={f.description} onChange={set('description')} placeholder="What happened, and what needs to be done?" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Team" htmlFor="c-team" error={E.team}><select id="c-team" className="field" value={f.team} onChange={set('team')}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Category" htmlFor="c-cat"><select id="c-cat" className="field" value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></Field>
          <Field label="Priority" htmlFor="c-prio"><select id="c-prio" className="field" value={f.priority} onChange={set('priority')}>{['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{label(p)}</option>)}</select></Field>
          <Field label="Due date" htmlFor="c-due" error={E.dueDate}><input id="c-due" type="date" className="field" value={f.dueDate} onChange={set('dueDate')} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Spinner />}Create item</button>
        </div>
      </form>
    </Modal>
  );
}
