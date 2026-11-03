import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants';

interface PreferencesState {
  activeSemesterId: string | null;
  onboardingSkipped: boolean;
  hydrated: boolean;
  setActiveSemester: (id: string | null) => void;
  setOnboardingSkipped: (value: boolean) => void;
  hydrate: () => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  activeSemesterId: null,
  onboardingSkipped: false,
  hydrated: false,
  setActiveSemester: (id) => {
    set({ activeSemesterId: id });
    if (id) void AsyncStorage.setItem(STORAGE_KEYS.activeSemester, id);
    else void AsyncStorage.removeItem(STORAGE_KEYS.activeSemester);
  },
  setOnboardingSkipped: (value) => {
    set({ onboardingSkipped: value });
    void AsyncStorage.setItem(STORAGE_KEYS.onboardingSkipped, value ? '1' : '0');
  },
  hydrate: async () => {
    const [semester, skipped] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.activeSemester),
      AsyncStorage.getItem(STORAGE_KEYS.onboardingSkipped),
    ]);
    set({ activeSemesterId: semester, onboardingSkipped: skipped === '1', hydrated: true });
  },
}));
