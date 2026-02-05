import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type RecordingState = 'idle' | 'recording' | 'processing' | 'complete';

export interface ModelLoadingState {
  isLoading: boolean;
  stage: 'downloading' | 'loading' | 'warmup' | 'ready' | 'error' | '';
  progress: number;
  message: string;
}

export interface HotkeyConfig {
  modifiers: string[];
  key: string;
  display: string;
}

const inMemoryStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

interface AppState {
  recordingState: RecordingState;
  currentTranscription: string;
  partialTranscription: string;
  autoPasteEnabled: boolean;
  onboardingCompleted: boolean;
  history: Array<{ text: string; timestamp: number }>;
  modelLoadingState: ModelLoadingState;
  hotkey: HotkeyConfig;

  setRecordingState: (state: RecordingState) => void;
  setCurrentTranscription: (text: string) => void;
  setPartialTranscription: (text: string) => void;
  setAutoPasteEnabled: (enabled: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setModelLoadingState: (state: Partial<ModelLoadingState>) => void;
  setHotkey: (hotkey: HotkeyConfig) => void;
  addToHistory: (text: string) => void;
  clearHistory: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      recordingState: 'idle',
      currentTranscription: '',
      partialTranscription: '',
      autoPasteEnabled: true,
      onboardingCompleted: false,
      history: [],
      modelLoadingState: {
        isLoading: true,
        stage: '',
        progress: 0,
        message: 'Connecting...',
      },
      hotkey: {
        modifiers: ['Alt'],
        key: 'Space',
        display: '\u2325 Space',
      },

      setRecordingState: (state) => set({ recordingState: state }),
      setCurrentTranscription: (text) => set({ currentTranscription: text }),
      setPartialTranscription: (text) => set({ partialTranscription: text }),
      setAutoPasteEnabled: (enabled) => set({ autoPasteEnabled: enabled }),
      setOnboardingCompleted: (completed) => set({ onboardingCompleted: completed }),
      setModelLoadingState: (state) =>
        set((prev) => ({
          modelLoadingState: { ...prev.modelLoadingState, ...state },
        })),
      setHotkey: (hotkey) => set({ hotkey }),
      addToHistory: (text) =>
        set((state) => ({
          history: [
            { text, timestamp: Date.now() },
            ...state.history.slice(0, 19),
          ],
        })),
      clearHistory: () => set({ history: [] }),
      reset: () =>
        set({
          recordingState: 'idle',
          currentTranscription: '',
          partialTranscription: '',
        }),
    }),
    {
      name: 'voiceflow-storage',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return inMemoryStorage;
        }
        const storage = window.localStorage;
        if (!storage || typeof storage.setItem !== 'function') {
          return inMemoryStorage;
        }
        return storage;
      }),
      partialize: (state) => ({
        autoPasteEnabled: state.autoPasteEnabled,
        onboardingCompleted: state.onboardingCompleted,
        history: state.history,
        hotkey: state.hotkey,
      }),
    }
  )
);
