import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RecordingState = 'idle' | 'recording' | 'processing' | 'complete';

interface AppState {
  isDarkMode: boolean;
  recordingState: RecordingState;
  currentTranscription: string;
  partialTranscription: string;
  audioLevel: number;
  triggerKeys: string[];
  autoPasteEnabled: boolean;
  history: Array<{ text: string; timestamp: number }>;

  setDarkMode: (isDark: boolean) => void;
  setRecordingState: (state: RecordingState) => void;
  setCurrentTranscription: (text: string) => void;
  setPartialTranscription: (text: string) => void;
  setAudioLevel: (level: number) => void;
  setTriggerKeys: (keys: string[]) => void;
  setAutoPasteEnabled: (enabled: boolean) => void;
  addToHistory: (text: string) => void;
  clearHistory: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isDarkMode: false,
      recordingState: 'idle',
      currentTranscription: '',
      partialTranscription: '',
      audioLevel: 0,
      triggerKeys: ['fn', 'capslock'],
      autoPasteEnabled: true,
      history: [],

      setDarkMode: (isDark) => set({ isDarkMode: isDark }),
      setRecordingState: (state) => set({ recordingState: state }),
      setCurrentTranscription: (text) => set({ currentTranscription: text }),
      setPartialTranscription: (text) => set({ partialTranscription: text }),
      setAudioLevel: (level) => set({ audioLevel: level }),
      setTriggerKeys: (keys) => set({ triggerKeys: keys }),
      setAutoPasteEnabled: (enabled) => set({ autoPasteEnabled: enabled }),
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
          audioLevel: 0,
        }),
    }),
    {
      name: 'voiceflow-storage',
      partialize: (state) => ({
        triggerKeys: state.triggerKeys,
        autoPasteEnabled: state.autoPasteEnabled,
        history: state.history,
      }),
    }
  )
);
