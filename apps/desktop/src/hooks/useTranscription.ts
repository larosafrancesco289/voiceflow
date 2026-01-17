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
          await writeText(text);
          await invoke('hide_bubble');
          await invoke('paste_from_clipboard');
          reset();
          return;
        } catch (error) {
          console.error('[Transcription] Failed to paste:', error);
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
      console.error('[Transcription] WebSocket error:', error);
      setRecordingState('idle');
      ensureServerRunning();
    },
  });

  const { start: startCapture, stop: stopCapture, analyser } = useAudioCapture({
    onAudioData: (data) => {
      sendAudio(data);
    },
    onError: (error) => {
      console.error('[Transcription] Audio capture error:', error);
      setRecordingState('idle');
    },
  });

  const startRecording = useCallback(async () => {
    if (recordingState !== 'idle') return;
    if (!isConnected || !isReady) return;

    try {
      await invoke('show_bubble');
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

  // One-time setup: connect to server and register event listeners
  useEffect(() => {
    ensureServerRunning();
    connect();

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    recordingState,
    isConnected,
    isReady,
    startRecording,
    stopRecording,
    analyser,
  };
}
