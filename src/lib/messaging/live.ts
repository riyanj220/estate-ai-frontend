import "client-only";
import { useEffect, useRef, useState } from "react";

/**
 * Live delivery (Stories 7.2 and 7.3). `/ws` is on this origin (Next.js proxies it to Django, so the session cookie and the Origin
 * are the site's). The socket is receive-only: nothing is ever sent on it, and its events carry ids only, so what is new is read
 * over REST. The shapes are the backend's `events.schema.json`.
 */
export type LiveEvent = { type: "ready" } | { type: "message.created"; conversation_id: string; message_id: string; seq: number };

const SESSION_ENDED = 4401;
const TOO_MANY = 4429;
const MAX_DELAY = 30_000;

export type LiveState = "connecting" | "live" | "off";

function parse(data: unknown): LiveEvent | null {
  try {
    const event = JSON.parse(String(data)) as LiveEvent;
    return event.type === "ready" || event.type === "message.created" ? event : null;
  } catch {
    return null;
  }
}

/**
 * Holds one socket while `enabled`, and reconnects after a drop, waiting 1 s, 2 s, 4 s ... up to 30 s. `onEvent` gets `ready` after
 * every (re)connection, which is the moment to read what was missed. `onEnded` runs when the server says the session is over; there
 * is no reconnection after that.
 */
export function useLiveEvents(enabled: boolean, onEvent: (event: LiveEvent) => void, onEnded: () => void): LiveState {
  const [state, setState] = useState<LiveState>("connecting");
  const handlers = useRef({ onEvent, onEnded });
  useEffect(() => {
    handlers.current = { onEvent, onEnded };
  });

  useEffect(() => {
    if (!enabled) return;
    let socket: WebSocket | null = null;
    let timer: number | undefined;
    let attempts = 0;
    let stopped = false;

    function connect() {
      socket = new WebSocket(`${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`);
      socket.onmessage = ({ data }) => {
        const event = parse(data);
        if (!event) return;
        if (event.type === "ready") {
          attempts = 0;
          setState("live");
        }
        handlers.current.onEvent(event);
      };
      socket.onclose = ({ code }) => {
        if (stopped) return;
        setState("off");
        if (code === SESSION_ENDED) return handlers.current.onEnded();
        const delay = code === TOO_MANY ? MAX_DELAY : Math.min(MAX_DELAY, 1000 * 2 ** attempts);
        attempts += 1;
        timer = window.setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      if (socket) {
        socket.onmessage = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, [enabled]);

  return state;
}
