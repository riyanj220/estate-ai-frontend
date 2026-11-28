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

type Subscriber = { onEvent: (event: LiveEvent) => void; onEnded: () => void; onState: (state: LiveState) => void };

// One socket for the page, shared by everything on screen that listens (the conversation list and the open thread).
const subscribers = new Set<Subscriber>();
let socket: WebSocket | null = null;
let timer: number | undefined;
let attempts = 0;
let current: LiveState = "connecting";

function setCurrent(state: LiveState) {
  current = state;
  for (const subscriber of [...subscribers]) subscriber.onState(state);
}

function connect() {
  socket = new WebSocket(`${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`);
  socket.onmessage = ({ data }) => {
    const event = parse(data);
    if (!event) return;
    if (event.type === "ready") {
      attempts = 0;
      setCurrent("live");
    }
    for (const subscriber of [...subscribers]) subscriber.onEvent(event);
  };
  socket.onclose = ({ code }) => {
    socket = null;
    setCurrent("off");
    if (code === SESSION_ENDED) {
      for (const subscriber of [...subscribers]) subscriber.onEnded();
      return;
    }
    const delay = code === TOO_MANY ? MAX_DELAY : Math.min(MAX_DELAY, 1000 * 2 ** attempts);
    attempts += 1;
    timer = window.setTimeout(connect, delay);
  };
}

function disconnect() {
  window.clearTimeout(timer);
  attempts = 0;
  current = "connecting";
  if (!socket) return;
  socket.onmessage = null;
  socket.onclose = null;
  socket.close();
  socket = null;
}

/**
 * Listens while `enabled`. The first listener opens the socket and the last one to leave closes it; it reconnects after a drop,
 * waiting 1 s, 2 s, 4 s ... up to 30 s. `onEvent` gets `ready` after every (re)connection, which is the moment to read what was
 * missed; a listener that joins an open socket gets it at once. `onEnded` runs when the server says the session is over; there is no
 * reconnection after that.
 */
export function useLiveEvents(enabled: boolean, onEvent: (event: LiveEvent) => void, onEnded: () => void): LiveState {
  const [state, setState] = useState<LiveState>("connecting");
  const handlers = useRef({ onEvent, onEnded });
  useEffect(() => {
    handlers.current = { onEvent, onEnded };
  });

  useEffect(() => {
    if (!enabled) return;
    const subscriber: Subscriber = {
      onEvent: (event) => handlers.current.onEvent(event),
      onEnded: () => handlers.current.onEnded(),
      onState: setState,
    };
    const first = subscribers.size === 0;
    subscribers.add(subscriber);
    // A moment later, so that an effect that is cleaned up at once (strict mode) opens nothing twice.
    const join = window.setTimeout(() => {
      if (first && !socket) return connect();
      setState(current);
      if (current === "live") subscriber.onEvent({ type: "ready" });
    }, 0);
    return () => {
      window.clearTimeout(join);
      subscribers.delete(subscriber);
      if (subscribers.size === 0) disconnect();
    };
  }, [enabled]);

  return state;
}
