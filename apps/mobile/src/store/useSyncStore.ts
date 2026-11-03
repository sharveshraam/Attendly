import { create } from 'zustand';

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pending: number;
  conflicts: number;
  lastSyncAt: string | null;
  lastError: string | null;
  setOnline: (value: boolean) => void;
  setSyncing: (value: boolean) => void;
  setCounts: (pending: number, conflicts: number) => void;
  setLastSync: (iso: string | null) => void;
  setLastError: (error: string | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: true,
  isSyncing: false,
  pending: 0,
  conflicts: 0,
  lastSyncAt: null,
  lastError: null,
  setOnline: (value) => set({ isOnline: value }),
  setSyncing: (value) => set({ isSyncing: value }),
  setCounts: (pending, conflicts) => set({ pending, conflicts }),
  setLastSync: (iso) => set({ lastSyncAt: iso }),
  setLastError: (error) => set({ lastError: error }),
}));
