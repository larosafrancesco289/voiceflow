import { useCallback, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useAppStore } from '../stores/appStore';
import { useAudioCapture } from './useAudioCapture';
import {
  useWebSocket,
  LoadingProgress,
  WebSocketErrorInfo,
} from './useWebSocket';
import {
  ensureServerRunning,
  getErrorMessage,
  SERVER_WS_URL,
} from '../utils/serverControl';

interface UseTranscriptionOptions {
  autoStart?: boolean;
  listenForGlobalShortcuts?: boolean;
}

export function useTranscription({
  autoStart = true,
  listenForGlobalShortcuts = true,
}: UseTranscriptionOptions = {}) {
  const recordingState = useAppStore((state) => state.recordingState);
  const setRecordingState = useAppStore((state) => state.setRecordingState);
  const setCurrentTranscription = useAppStore((state) => state.setCurrentTranscription);
  const setPartialTranscription = useAppStore((state) => state.setPartialTranscription);
  const addToHistory = useAppStore((state) => state.addToHistory);
  const autoPasteEnabled = useAppStore((state) => state.autoPasteEnabled);
  const reset = useAppStore((state) => state.reset);
  const setModelLoadingState = useAppStore((state) => state.setModelLoadingState);

  const handleLoadingProgress = useCallback(
    (progress: LoadingProgress) => {
      setModelLoadingState({
        isLoading: progress.stage !== 'ready',
        stage: progress.stage,
        progress: progress.progress,
        message: progress.message,
      });
    },
    [setModelLoadingState]
  );
  const autoStartTriggeredRef = useRef(false);

  const ensureVoiceServerRunning = useCallback(async () => {
    try {
      await ensureServerRunning();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to start voice server');
      console.error('[Transcription] Failed to ensure server is running:', error);
      setModelLoadingState({
        isLoading: true,
        stage: 'error',
        progress: 0,
        message,
      });
      throw error;
    }
  }, [setModelLoadingState]);

  const handleFinalTranscription = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        reset();
        if (isTauri()) {
          void invoke('hide_bubble');
        }
        return;
      }

      setCurrentTranscription(text);
      setRecordingState('complete');
      addToHistory(text);

      if (autoPasteEnabled && isTauri()) {
        try {
          await writeText(text);
          await invoke('hide_bubble');
          await invoke('paste_from_clipboard');
          reset();
          return;
        } catch (error) {
          console.error('[Transcription] Failed to paste:', error);
        }
      }

      setTimeout(() => {
        reset();
        if (isTauri()) {
          void invoke('hide_bubble');
        }
      }, 1000);
    },
    [setCurrentTranscription, setRecordingState, addToHistory, autoPasteEnabled, reset]
  );

  const {
    connect,
    disconnect,
    sendAudio,
    startStream,
    endStream,
    isConnected,
    isReady,
    loadingProgress,
  } = useWebSocket({
    url: SERVER_WS_URL,
    onPartial: setPartialTranscription,
    onFinal: handleFinalTranscription,
    onError: ({ message, affectsReadiness }: WebSocketErrorInfo) => {
      console.error('[Transcription] WebSocket error:', message);

      if (affectsReadiness) {
        setRecordingState('idle');
        setModelLoadingState({
          isLoading: true,
          stage: 'error',
          progress: 0,
          message,
        });
      } else {
        reset();
        if (isTauri()) {
          void invoke('hide_bubble');
        }
      }

      if (message === 'WebSocket connection error') {
        void ensureVoiceServerRunning();
      }
    },
    onLoading: handleLoadingProgress,
  });

  const { start: startCapture, stop: stopCapture, analyser } = useAudioCapture({
    onAudioData: sendAudio,
    onError: (error) => {
      console.error('[Transcription] Audio capture error:', error);
      setRecordingState('idle');
    },
  });

  useEffect(() => {
    if (isReady) {
      setModelLoadingState({
        isLoading: false,
        stage: 'ready',
        progress: 1,
        message: 'Model ready',
      });
    }
  }, [isReady, setModelLoadingState]);

  const startRecording = useCallback(async () => {
    if (recordingState !== 'idle') return;
    if (!isConnected || !isReady) return;

    try {
      if (isTauri()) {
        await invoke('show_bubble');
      }
      setRecordingState('recording');
      setPartialTranscription('');
      setCurrentTranscription('');
      startStream();
      await startCapture();
    } catch (error) {
      console.error('[Transcription] Failed to start recording:', error);
      setRecordingState('idle');
    }
  }, [
    recordingState,
    isConnected,
    isReady,
    setRecordingState,
    setPartialTranscription,
    setCurrentTranscription,
    startStream,
    startCapture,
  ]);

  const stopRecording = useCallback(async () => {
    if (recordingState !== 'recording') return;

    setRecordingState('processing');
    stopCapture();
    endStream();
  }, [recordingState, setRecordingState, stopCapture, endStream]);

  // Refs to hold latest callbacks (avoid stale closures in event listeners)
  const startRecordingRef = useRef(startRecording);
  const stopRecordingRef = useRef(stopRecording);
  startRecordingRef.current = startRecording;
  stopRecordingRef.current = stopRecording;

  const startServer = useCallback(() => {
    void (async () => {
      try {
        await ensureVoiceServerRunning();
        connect();
      } catch {
        // Store state is already updated in ensureVoiceServerRunning.
      }
    })();
  }, [ensureVoiceServerRunning, connect]);

  useEffect(() => {
    let disposed = false;
    let unlistenStart: (() => void) | null = null;
    let unlistenStop: (() => void) | null = null;

    if (autoStart && !autoStartTriggeredRef.current) {
      autoStartTriggeredRef.current = true;
      startServer();
    }

    if (!listenForGlobalShortcuts || !isTauri()) {
      return () => {
        disconnect();
      };
    }

    void listen('recording-start', () => {
      void startRecordingRef.current();
    }).then((fn) => {
      if (disposed) {
        fn();
        return;
      }
      unlistenStart = fn;
    });

    void listen('recording-stop', () => {
      void stopRecordingRef.current();
    }).then((fn) => {
      if (disposed) {
        fn();
        return;
      }
      unlistenStop = fn;
    });

    return () => {
      disposed = true;
      unlistenStart?.();
      unlistenStop?.();
      disconnect();
    };
  }, [autoStart, disconnect, listenForGlobalShortcuts, startServer]);

  return {
    recordingState,
    isConnected,
    isReady,
    startRecording,
    stopRecording,
    startServer,
    analyser,
    loadingProgress,
  };
}
