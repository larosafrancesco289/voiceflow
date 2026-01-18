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
  const isConnectingRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);

  const safeSend = useCallback((data: string | ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;
    if (isConnectingRef.current) return;

    isConnectingRef.current = true;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        isConnectingRef.current = false;
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
              onLoading?.(progress);
              break;
            }
            case 'partial':
              if (message.text) onPartial?.(message.text);
              break;
            case 'final':
              onFinal?.(message.text || '');
              break;
            case 'error':
              if (message.error) onError?.(message.error);
              break;
          }
        } catch {
          console.error('Failed to parse WebSocket message');
        }
      };

      ws.onerror = (error) => {
        isConnectingRef.current = false;
        console.error('WebSocket error:', error);
        onError?.('WebSocket connection error');
      };

      ws.onclose = () => {
        isConnectingRef.current = false;
        setIsConnected(false);
        setIsReady(false);
        console.log('WebSocket disconnected, reconnecting in 2s...');

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
      };
    } catch (error) {
      isConnectingRef.current = false;
      console.error('Failed to connect WebSocket:', error);
    }
  }, [url, onPartial, onFinal, onError, onLoading]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsReady(false);
  }, []);

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
