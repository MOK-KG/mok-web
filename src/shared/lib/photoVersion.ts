import { useSyncExternalStore } from 'react';

let version = 0;
const listeners = new Set<() => void>();

export function bumpPhotoVersion() {
  version += 1;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const usePhotoVersion = () => useSyncExternalStore(subscribe, () => version);
