import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { api, ApiError } from '../api';
import CreateItemModal from '../CreateItemModal';
import ItemDetail from '../pages/ItemDetail';
import { ToastProvider } from '../ui';

const wrap = (ui, path = '/') => render(<ToastProvider><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></ToastProvider>);
afterEach(() => vi.restoreAllMocks());

test('retrying a failed submission re-sends the SAME Idempotency-Key; editing the form gets a new one', async () => {
  const keys = [];
  vi.spyOn(api, 'create').mockImplementation(async (_b, key) => { keys.push(key); throw new ApiError(0, { error: { code: 'NETWORK', message: 'Cannot reach the server' } }); });
  wrap(<CreateItemModal teams={[{ id: 't1', name: 'Payments' }]} onClose={() => {}} onCreated={() => {}} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Title'), 'Refund stuck in pending');
  await user.click(screen.getByRole('button', { name: /create item/i }));
  await waitFor(() => expect(keys).toHaveLength(1));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: /create item/i })); 
  await waitFor(() => expect(keys).toHaveLength(2));
  expect(keys[1]).toBe(keys[0]);
  await user.type(screen.getByLabelText('Title'), ' again'); 
  await user.click(screen.getByRole('button', { name: /create item/i }));
  await waitFor(() => expect(keys).toHaveLength(3));
  expect(keys[2]).not.toBe(keys[0]);
});

test('server validation errors are shown next to the field', async () => {
  vi.spyOn(api, 'create').mockRejectedValue(new ApiError(400, { error: { code: 'VALIDATION_ERROR', message: 'Fix', fields: { title: 'Title must be at least 3 characters' } } }));
  wrap(<CreateItemModal teams={[{ id: 't1', name: 'Payments' }]} onClose={() => {}} onCreated={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: /create item/i }));
  expect(await screen.findByText('Title must be at least 3 characters')).toBeInTheDocument();
});

test('losing a claim race shows the conflict and the latest assignee instead of a false success', async () => {
  const base = { id: 'i1', title: 'Chargeback spike', description: '', category: 'payment', status: 'open', priority: 'high', team: { _id: 't', name: 'Payments', key: 'PAY' }, creator: { _id: 'u0', name: 'Maya' }, assignee: null, dueDate: null, version: 1, updatedAt: new Date().toISOString() };
  vi.spyOn(api, 'get').mockResolvedValue({ item: base, permissions: { claim: true, comment: true } });
  vi.spyOn(api, 'comments').mockResolvedValue({ comments: [] });
  vi.spyOn(api, 'activity').mockResolvedValue({ activity: [] });
  const winner = { ...base, status: 'in_progress', assignee: { _id: 'u9', name: 'Omar Member' }, version: 2 };
  vi.spyOn(api, 'claim').mockRejectedValue(new ApiError(409, { error: { code: 'ALREADY_CLAIMED', message: 'Omar Member already took this item.', details: { current: winner } } }));
  wrap(<Routes><Route path="/items/:id" element={<ItemDetail />} /></Routes>, '/items/i1');
  await userEvent.click(await screen.findByRole('button', { name: /take responsibility/i }));
  expect(await screen.findByText('Someone got there first')).toBeInTheDocument();
  expect(screen.getAllByText('Omar Member').length).toBeGreaterThan(0); 
  expect(screen.queryByRole('button', { name: /take responsibility/i })).not.toBeInTheDocument();
});
