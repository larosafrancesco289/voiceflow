import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../stores/appStore';
import { useTranscription } from './useTranscription';

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, () => void>();
  return {
    listeners,
    latestWebSocketOptions: null as null | {
      onFinal?: (text: string) => Promise<void>;
      onError?: (error: string) => void;
    },
    listenMock: vi.fn(async (eventName: string, callback: () => void) => {
      listeners.set(eventName, callback);
      return () => listeners.delete(eventName);
    }),
    invokeMock: vi.fn(),
    writeTextMock: vi.fn(),
    connectMock: vi.fn(),
    disconnectMock: vi.fn(),
    startStreamMock: vi.fn(),
    endStreamMock: vi.fn(),
    startCaptureMock: vi.fn(async () => undefined),
    stopCaptureMock: vi.fn(),
  };
});

vi.mock('@tauri-apps/api/event', () => ({
  listen: mocks.listenMock,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invokeMock,
  isTauri: () => true,
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: mocks.writeTextMock,
}));

vi.mock('./useWebSocket', () => ({
  useWebSocket: (options: unknown) => {
    mocks.latestWebSocketOptions = options as {
      onFinal?: (text: string) => Promise<void>;
      onError?: (error: string) => void;
    };
    return {
      connect: mocks.connectMock,
      disconnect: mocks.disconnectMock,
      sendAudio: vi.fn(),
      startStream: mocks.startStreamMock,
      endStream: mocks.endStreamMock,
      isConnected: true,
      isReady: true,
      loadingProgress: null,
    };
  },
}));

vi.mock('./useAudioCapture', () => ({
  useAudioCapture: () => ({
    start: mocks.startCaptureMock,
    stop: mocks.stopCaptureMock,
    analyser: null,
  }),
}));

describe('useTranscription', () => {
  beforeEach(() => {
    mocks.listeners.clear();
    mocks.latestWebSocketOptions = null;
    mocks.invokeMock.mockReset().mockResolvedValue(undefined);
    mocks.writeTextMock.mockReset().mockResolvedValue(undefined);
    mocks.connectMock.mockReset();
    mocks.disconnectMock.mockReset();
    mocks.startStreamMock.mockReset();
    mocks.endStreamMock.mockReset();
    mocks.startCaptureMock.mockReset().mockResolvedValue(undefined);
    mocks.stopCaptureMock.mockReset();

    useAppStore.setState({
      recordingState: 'idle',
      currentTranscription: '',
      partialTranscription: '',
      autoPasteEnabled: true,
      history: [],
      modelLoadingState: {
        isLoading: false,
        stage: 'ready',
        progress: 1,
        message: 'Model ready',
      },
    });
  });

  it('handles hotkey start/stop and final auto-paste flow', async () => {
    const { unmount } = renderHook(() => useTranscription({ autoStart: true }));

    await waitFor(() => {
      expect(mocks.invokeMock).toHaveBeenCalledWith('ensure_server_running');
    });
    expect(mocks.connectMock).toHaveBeenCalledTimes(1);
    expect(mocks.listeners.has('recording-start')).toBe(true);
    expect(mocks.listeners.has('recording-stop')).toBe(true);

    await act(async () => {
      mocks.listeners.get('recording-start')?.();
    });
    expect(mocks.startStreamMock).toHaveBeenCalledTimes(1);
    expect(mocks.startCaptureMock).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().recordingState).toBe('recording');
    expect(mocks.invokeMock).toHaveBeenCalledWith('show_bubble');

    await act(async () => {
      mocks.listeners.get('recording-stop')?.();
    });
    expect(mocks.stopCaptureMock).toHaveBeenCalledTimes(1);
    expect(mocks.endStreamMock).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().recordingState).toBe('processing');

    await act(async () => {
      await mocks.latestWebSocketOptions?.onFinal?.('hello world');
    });
    expect(mocks.writeTextMock).toHaveBeenCalledWith('hello world');
    expect(mocks.invokeMock).toHaveBeenCalledWith('hide_bubble');
    expect(mocks.invokeMock).toHaveBeenCalledWith('paste_from_clipboard');
    expect(useAppStore.getState().history[0]?.text).toBe('hello world');

    unmount();
    expect(mocks.disconnectMock).toHaveBeenCalledTimes(1);
  });

  it('requests sidecar ensure on websocket connection errors', async () => {
    renderHook(() => useTranscription({ autoStart: true }));
    await waitFor(() => {
      expect(mocks.invokeMock).toHaveBeenCalledWith('ensure_server_running');
    });
    const initialEnsureCalls = mocks.invokeMock.mock.calls.filter(
      (call) => call[0] === 'ensure_server_running'
    ).length;

    await act(async () => {
      mocks.latestWebSocketOptions?.onError?.('WebSocket connection error');
    });

    const finalEnsureCalls = mocks.invokeMock.mock.calls.filter(
      (call) => call[0] === 'ensure_server_running'
    ).length;
    expect(finalEnsureCalls).toBeGreaterThan(initialEnsureCalls);
    expect(useAppStore.getState().modelLoadingState.stage).toBe('error');
    expect(useAppStore.getState().modelLoadingState.isLoading).toBe(true);
  });
});
