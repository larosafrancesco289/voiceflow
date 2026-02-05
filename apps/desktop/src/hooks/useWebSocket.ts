import { useCallback, useRef, useEffect, useState } from 'react';

export interface LoadingProgress {
  stage: 'downloading' | 'loading' | 'warmup' | 'ready' | 'error';
  progress: number;
  message: string;
}

interface WebSocketMessage {
  type: 'partial' | 'final' | 'error' | 'ready' | 'loading';
  text?: string;
  error?: string;
  stage?: string;
  progress?: number;
  message?: string;
}

interface UseWebSocketOptions {
  url: string;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (error: string) => void;
  onLoading?: (progress: LoadingProgress) => void;
}

export function useWebSocket({
  url,
  onPartial,
  onFinal,
  onError,
  onLoading,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const isConnectingRef = useRef(false);
  const connectRef = useRef<() => void>(() => undefined);
  const onPartialRef = useRef(onPartial);
  const onFinalRef = useRef(onFinal);
  const onErrorRef = useRef(onError);
  const onLoadingRef = useRef(onLoading);
  const [isConnected, setIsConnected] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);

  useEffect(() => {
    onPartialRef.current = onPartial;
  }, [onPartial]);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onLoadingRef.current = onLoading;
  }, [onLoading]);

  const clearReconnectTimeout = useCallback(() => {
    if (!reconnectTimeoutRef.current) return;
    clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = null;
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!shouldReconnectRef.current) return;
    clearReconnectTimeout();

    const baseDelay = Math.min(2000 * 2 ** reconnectAttemptsRef.current, 10000);
    const jitter = Math.floor(Math.random() * 250);
    const delay = baseDelay + jitter;
    reconnectAttemptsRef.current = Math.min(reconnectAttemptsRef.current + 1, 5);

    console.log(`[WebSocket] Disconnected, reconnecting in ${delay}ms...`);
    reconnectTimeoutRef.current = setTimeout(() => {
      connectRef.current();
    }, delay);
  }, [clearReconnectTimeout]);

  const safeSend = useCallback((data: string | ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const connect = useCallback(() => {
    shouldReconnectRef.current = true;
    clearReconnectTimeout();

    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;
    if (isConnectingRef.current) return;

    isConnectingRef.current = true;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        isConnectingRef.current = false;
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'ready':
              setIsReady(true);
              setLoadingProgress(null);
              break;
            case 'loading': {
              const progress: LoadingProgress = {
                stage: (message.stage as LoadingProgress['stage']) || 'loading',
                progress: message.progress || 0,
                message: message.message || 'Loading...',
              };
              setLoadingProgress(progress);
              onLoadingRef.current?.(progress);
              break;
            }
            case 'partial':
              if (message.text) onPartialRef.current?.(message.text);
              break;
            case 'final':
              onFinalRef.current?.(message.text || '');
              break;
            case 'error':
              if (message.error) onErrorRef.current?.(message.error);
              break;
          }
        } catch {
          console.error('Failed to parse WebSocket message');
        }
      };

      ws.onerror = (error) => {
        isConnectingRef.current = false;
        console.error('WebSocket error:', error);
        onErrorRef.current?.('WebSocket connection error');
      };

      ws.onclose = () => {
        isConnectingRef.current = false;
        wsRef.current = null;
        setIsConnected(false);
        setIsReady(false);
        scheduleReconnect();
      };
    } catch (error) {
      isConnectingRef.current = false;
      console.error('Failed to connect WebSocket:', error);
      scheduleReconnect();
    }
  }, [url, clearReconnectTimeout, scheduleReconnect]);

  connectRef.current = connect;

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    clearReconnectTimeout();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsReady(false);
    setLoadingProgress(null);
  }, [clearReconnectTimeout]);

  const sendAudio = useCallback((data: Int16Array) => {
    safeSend(data.buffer as ArrayBuffer);
  }, [safeSend]);

  const endStream = useCallback(() => {
    safeSend(JSON.stringify({ type: 'end' }));
  }, [safeSend]);

  const startStream = useCallback(() => {
    safeSend(JSON.stringify({ type: 'start' }));
  }, [safeSend]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    sendAudio,
    startStream,
    endStream,
    isConnected,
    isReady,
    loadingProgress,
  };
}
