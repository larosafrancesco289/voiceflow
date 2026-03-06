import { invoke, isTauri } from '@tauri-apps/api/core';

export const SERVER_BASE_URL = 'http://127.0.0.1:8765';
export const SERVER_WS_URL = 'ws://127.0.0.1:8765/ws';

const MODEL_RELOAD_URL = `${SERVER_BASE_URL}/model/reload`;
const RELOAD_RETRY_DELAYS_MS = [250, 500, 1000, 1500];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export async function ensureServerRunning(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  await invoke('ensure_server_running');
}

export async function requestModelReload(): Promise<void> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < RELOAD_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(MODEL_RELOAD_URL, { method: 'POST' });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          detail.trim() || `Model reload request failed with status ${response.status}`
        );
      }

      return;
    } catch (error) {
      lastError = error;

      if (attempt === RELOAD_RETRY_DELAYS_MS.length - 1) {
        break;
      }

      await wait(RELOAD_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw new Error(getErrorMessage(lastError, 'Failed to restart the speech model'));
}

export async function recoverTranscriptionServer(): Promise<void> {
  await ensureServerRunning();
  await requestModelReload();
}
