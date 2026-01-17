import { useCallback, useRef, useEffect, useState } from 'react';

interface WebSocketMessage {
  type: 'partial' | 'final' | 'error' | 'ready';
  text?: string;
  error?: string;
}

interface UseWebSocketOptions {
  url: string;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (error: string) => void;
  onReady?: () => void;
}

export function useWebSocket({
  url,
  onPartial,
  onFinal,
  onError,
  onReady,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
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
              onReady?.();
              break;
            case 'partial':
              if (message.text) onPartial?.(message.text);
              break;
            case 'final':
              if (message.text) onFinal?.(message.text);
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
  }, [url, onPartial, onFinal, onError, onReady]);

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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data.buffer);
    }
  }, []);

  const endStream = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
    }
  }, []);

  const startStream = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start' }));
    }
  }, []);

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
  };
}
