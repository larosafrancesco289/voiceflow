import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RecordingState = 'idle' | 'recording' | 'processing' | 'complete';

interface AppState {
  recordingState: RecordingState;
  currentTranscription: string;
  partialTranscription: string;
  autoPasteEnabled: boolean;
  onboardingCompleted: boolean;
  history: Array<{ text: string; timestamp: number }>;

  setRecordingState: (state: RecordingState) => void;
  setCurrentTranscription: (text: string) => void;
  setPartialTranscription: (text: string) => void;
  setAutoPasteEnabled: (enabled: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;
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

      setRecordingState: (state) => set({ recordingState: state }),
      setCurrentTranscription: (text) => set({ currentTranscription: text }),
      setPartialTranscription: (text) => set({ partialTranscription: text }),
      setAutoPasteEnabled: (enabled) => set({ autoPasteEnabled: enabled }),
      setOnboardingCompleted: (completed) => set({ onboardingCompleted: completed }),
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
      partialize: (state) => ({
        autoPasteEnabled: state.autoPasteEnabled,
        onboardingCompleted: state.onboardingCompleted,
        history: state.history,
      }),
    }
  )
);
