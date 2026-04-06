import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/app-store';
import type { WatchmanEvent, WebSocketMessage } from '../types';

// Use relative URL that goes through Vite proxy in development
const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/events`;
};
const RECONNECT_DELAY = 3000;

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountingRef = useRef(false);

  const addRealtimeEvent = useAppStore((state) => state.addRealtimeEvent);
  const setConnected = useAppStore((state) => state.setConnected);

  const connect = useCallback(() => {
    if (!sessionId || isUnmountingRef.current) {
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `${getWebSocketUrl()}?session=${encodeURIComponent(sessionId)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountingRef.current) {
          ws.close();
          return;
        }
        setConnected(true);
      };

      ws.onmessage = (event) => {
        if (isUnmountingRef.current) {
          return;
        }

        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          if (message.type === 'event' && message.payload) {
            const watchmanEvent = message.payload as WatchmanEvent;
            addRealtimeEvent(watchmanEvent);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        // Attempt to reconnect if not unmounting and still have a session
        if (!isUnmountingRef.current && sessionId) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // onclose will be called after error, which handles reconnection
      };
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      setConnected(false);

      // Schedule reconnection
      if (!isUnmountingRef.current && sessionId) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY);
      }
    }
  }, [sessionId, addRealtimeEvent, setConnected]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected(false);
  }, [setConnected]);

  useEffect(() => {
    isUnmountingRef.current = false;

    if (sessionId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      isUnmountingRef.current = true;
      disconnect();
    };
  }, [sessionId, connect, disconnect]);

  return {
    isConnected: useAppStore((state) => state.isConnected),
  };
}
