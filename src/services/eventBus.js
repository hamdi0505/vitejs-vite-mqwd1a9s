const listeners = new Map();

export function on(eventName, callback) {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName).add(callback);

  // unsubscribe
  return () => {
    listeners.get(eventName)?.delete(callback);
  };
}

export function emit(eventName, payload) {
  const set = listeners.get(eventName);
  if (!set) return;

  set.forEach((cb) => {
    try {
      cb(payload);
    } catch (e) {
      console.error("eventBus listener error:", e);
    }
  });
}

// Gemeinsames Event für Datenänderungen
export const EVENTS = {
  DATA_CHANGED: "DATA_CHANGED"
};