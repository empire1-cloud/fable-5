/* Minimal hash router — keeps dependencies to react + react-dom only and
   works from any static host or file://. */

import { useEffect, useState } from 'react';

function currentRoute(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h || '/';
}

/** Returns the full hash (path + optional `?query`). */
export function useHashRoute(): string {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

/** Splits a raw hash route into its path and parsed query params. */
export function parseRoute(raw: string): { path: string; query: URLSearchParams } {
  const [path, query = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(query) };
}

export function navigate(to: string): void {
  window.location.hash = to;
}

export function href(to: string): string {
  return `#${to}`;
}
