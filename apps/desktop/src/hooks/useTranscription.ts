import { useCallback, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useAppStore } from '../stores/appStore';
import { useAudioCapture } from './useAudioCapture';
import { useWebSocket } from './useWebSocket';

const WS_URL = 'ws://127.0.0.1:8765/ws';

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

  const handleFinalTranscription = useCallback(
    async (text: string) => {
      setCurrentTranscription(text);
      setRecordingState('complete');
      addToHistory(text);

      if (autoPasteEnabled && text.trim()) {
        try {
          await writeText(text);
          await invoke('add_to_history', { text });
          // Small delay before hiding to allow clipboard to settle
          await new Promise((resolve) => setTimeout(resolve, 50));
          await invoke('hide_bubble');
        } catch (error) {
          console.error('Failed to paste:', error);
        }
      }

      setTimeout(() => {
        reset();
        invoke('hide_bubble');
      }, 1500);
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
  }, [recordingState, setRecordingState, setPartialTranscription, setCurrentTranscription, startStream, startCapture]);

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

  useEffect(() => {
    connect();

    const unlistenStart = listen('recording-start', () => {
      startRecording();
    });

    const unlistenStop = listen('recording-stop', () => {
      stopRecording();
    });

    return () => {
      unlistenStart.then((fn) => fn());
      unlistenStop.then((fn) => fn());
    };
  }, [connect, startRecording, stopRecording]);

  return {
    recordingState,
    isConnected,
    isReady,
    startRecording,
    stopRecording,
    getAnalyser,
  };
}
