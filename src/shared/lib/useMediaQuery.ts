import { useEffect, useState } from 'react';

const match = (query: string) =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false;

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => match(query));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export const NARROW = '(max-width: 767px)';
