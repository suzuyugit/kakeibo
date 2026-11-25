import { useEffect, useState } from 'react';

// GitHub Pages ではサーバー側のルーティングが使えないので、ハッシュ（#/...）で画面を切り替える。

export type TabKey = 'home' | 'calendar' | 'settings';

export type Route = { name: TabKey };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'calendar') return { name: 'calendar' };
  if (parts[0] === 'settings') return { name: 'settings' };
  return { name: 'home' };
}

export function routeToHash(r: Route): string {
  return r.name === 'home' ? '#/' : `#/${r.name}`;
}

export function navigate(r: Route, opts: { replace?: boolean } = {}): void {
  const hash = routeToHash(r);
  if (opts.replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

/** たびメモのその旅行のお金タブ（同じサイトの /tabi-app/） */
export function tabimemoMoneyUrl(tripId: string): string {
  return `${new URL('../tabi-app/', location.href.split('#')[0]).href}#/trip/${encodeURIComponent(tripId)}/money`;
}
