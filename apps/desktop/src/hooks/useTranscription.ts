import { useCallback, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { Command, Child } from '@tauri-apps/plugin-shell';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useAppStore } from '../stores/appStore';
import { useAudioCapture } from './useAudioCapture';
import { useWebSocket } from './useWebSocket';

const WS_URL = 'ws://127.0.0.1:8765/ws';
const HEALTH_URL = 'http://127.0.0.1:8765/health';

export function useTranscription() {
  const {
    recordingState,
    setRecordingState,
    setCurrentTranscription,
    setPartialTranscription,
    addToHistory,
    autoPasteEnabled,
    reset,
  } = useAppStore();

  const serverProcessRef = useRef<Child | null>(null);
  const serverStartingRef = useRef(false);

  const checkServerHealth = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 500);
      const response = await fetch(HEALTH_URL, { signal: controller.signal });
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  const ensureServerRunning = useCallback(async () => {
    if (!isTauri()) return;
    if (serverProcessRef.current || serverStartingRef.current) return;

    const isHealthy = await checkServerHealth();
    if (isHealthy) return;

    serverStartingRef.current = true;
    try {
      const command = Command.sidecar('voiceflow-server');
      command.stdout.on('data', (line) => console.log(`[voiceflow-server] ${line}`));
      command.stderr.on('data', (line) => console.warn(`[voiceflow-server] ${line}`));
      const child = await command.spawn();
      serverProcessRef.current = child;
    } catch (error) {
      console.error('[Transcription] Failed to start server:', error);
    } finally {
      serverStartingRef.current = false;
    }
  }, [checkServerHealth]);

  const handleFinalTranscription = useCallback(
    async (text: string) => {
      // If no transcription, just reset and hide immediately
      if (!text.trim()) {
        reset();
        invoke('hide_bubble');
        return;
      }

      setCurrentTranscription(text);
      setRecordingState('complete');
      addToHistory(text);

      if (autoPasteEnabled) {
        try {
          // Copy to clipboard
          await writeText(text);
          await invoke('add_to_history', { text });
          // Hide bubble and paste immediately (window doesn't steal focus)
          await invoke('hide_bubble');
          // Simulate Cmd+V to paste
          console.log('[Transcription] Pasting text...');
          await invoke('paste_from_clipboard');
          console.log('[Transcription] Paste complete');
          // Reset state after pasting
          reset();
          return;
        } catch (error) {
          console.error('Failed to paste:', error);
        }
      }

      // Hide after showing the result briefly (only if not auto-pasting)
      setTimeout(() => {
        reset();
        invoke('hide_bubble');
      }, 1000);
    },
    [setCurrentTranscription, setRecordingState, addToHistory, autoPasteEnabled, reset]
  );

  const { connect, sendAudio, startStream, endStream, isConnected, isReady } = useWebSocket({
    url: WS_URL,
    onPartial: (text) => {
      setPartialTranscription(text);
    },
    onFinal: handleFinalTranscription,
    onError: (error) => {
      console.error('Transcription error:', error);
      setRecordingState('idle');
      ensureServerRunning();
    },
    onReady: () => {
      console.log('Transcription server ready');
    },
  });

  const { start: startCapture, stop: stopCapture, getAnalyser } = useAudioCapture({
    onAudioData: (data) => {
      sendAudio(data);
    },
    onError: (error) => {
      console.error('Audio capture error:', error);
      setRecordingState('idle');
    },
  });

  const startRecording = useCallback(async () => {
    console.log('[Transcription] startRecording called, state:', recordingState);
    if (recordingState !== 'idle') {
      console.log('[Transcription] Not idle, skipping');
      return;
    }
    if (!isConnected || !isReady) {
      console.log('[Transcription] Server not ready, skipping');
      return;
    }

    try {
      console.log('[Transcription] Starting recording...');
      await invoke('show_bubble');
      setRecordingState('recording');
      setPartialTranscription('');
      setCurrentTranscription('');
      startStream();
      await startCapture();
      console.log('[Transcription] Recording started');
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
    console.log('[Transcription] stopRecording called, state:', recordingState);
    if (recordingState !== 'recording') {
      console.log('[Transcription] Not recording, skipping');
      return;
    }

    console.log('[Transcription] Stopping recording...');
    setRecordingState('processing');
    stopCapture();
    endStream();
    console.log('[Transcription] Recording stopped, processing...');
  }, [recordingState, setRecordingState, stopCapture, endStream]);

  // Connect WebSocket once on mount
  const connectRef = useRef(connect);
  const ensureServerRunningRef = useRef(ensureServerRunning);

  useEffect(() => {
    connectRef.current = connect;
    ensureServerRunningRef.current = ensureServerRunning;
  }, [connect, ensureServerRunning]);

  useEffect(() => {
    ensureServerRunningRef.current();
    connectRef.current();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Setup event listeners with refs to avoid re-registration
  const startRecordingRef = useRef(startRecording);
  const stopRecordingRef = useRef(stopRecording);

  useEffect(() => {
    startRecordingRef.current = startRecording;
    stopRecordingRef.current = stopRecording;
  }, [startRecording, stopRecording]);

  useEffect(() => {
    const unlistenStart = listen('recording-start', () => {
      startRecordingRef.current();
    });

    const unlistenStop = listen('recording-stop', () => {
      stopRecordingRef.current();
    });

    return () => {
      unlistenStart.then((fn) => fn());
      unlistenStop.then((fn) => fn());
    };
  }, []);

  return {
    recordingState,
    isConnected,
    isReady,
    startRecording,
    stopRecording,
    getAnalyser,
  };
}
