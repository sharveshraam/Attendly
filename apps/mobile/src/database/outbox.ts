import { getDb } from './db';
import type { OutboxOp, SyncOpKind } from '@/types/domain';

interface OutboxRow {
  id: string;
  kind: string;
  payload: string;
  created_at: string;
  attempts: number;
  last_error: string | null;
  status: string;
  base_version: string | null;
}

function toOp(row: OutboxRow): OutboxOp {
  return {
    id: row.id,
    kind: row.kind as SyncOpKind,
    payload: JSON.parse(row.payload),
    createdAt: row.created_at,
    attempts: row.attempts,
    lastError: row.last_error,
    status: row.status as OutboxOp['status'],
  };
}

export function enqueueOp(kind: SyncOpKind, payload: unknown, baseVersion?: string | null): string {
  const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  getDb().runSync(
    'INSERT INTO outbox (id, kind, payload, created_at, attempts, status, base_version) VALUES (?, ?, ?, ?, 0, ?, ?)',
    [id, kind, JSON.stringify(payload), new Date().toISOString(), 'pending', baseVersion ?? null],
  );
  return id;
}

export function listOps(status?: OutboxOp['status']): OutboxOp[] {
  const rows = status
    ? getDb().getAllSync<OutboxRow>('SELECT * FROM outbox WHERE status = ? ORDER BY created_at', [status])
    : getDb().getAllSync<OutboxRow>('SELECT * FROM outbox ORDER BY created_at');
  return rows.map(toOp);
}

export function removeOp(id: string): void {
  getDb().runSync('DELETE FROM outbox WHERE id = ?', [id]);
}

export function markOpFailed(id: string, error: string): void {
  getDb().runSync('UPDATE outbox SET status = ?, last_error = ?, attempts = attempts + 1 WHERE id = ?', [
    'failed',
    error,
    id,
  ]);
}

export function markOpConflict(id: string, error: string): void {
  getDb().runSync('UPDATE outbox SET status = ?, last_error = ?, attempts = attempts + 1 WHERE id = ?', [
    'conflict',
    error,
    id,
  ]);
}

export function retryOp(id: string): void {
  getDb().runSync('UPDATE outbox SET status = ?, last_error = NULL WHERE id = ?', ['pending', id]);
}

export function pendingCount(): number {
  const row = getDb().getFirstSync<{ n: number }>(
    "SELECT COUNT(*) as n FROM outbox WHERE status IN ('pending','failed')",
  );
  return row?.n ?? 0;
}

export function conflictCount(): number {
  const row = getDb().getFirstSync<{ n: number }>("SELECT COUNT(*) as n FROM outbox WHERE status = 'conflict'");
  return row?.n ?? 0;
}

export function baseVersionOf(id: string): string | null {
  const row = getDb().getFirstSync<{ base_version: string | null }>('SELECT base_version FROM outbox WHERE id = ?', [id]);
  return row?.base_version ?? null;
}
