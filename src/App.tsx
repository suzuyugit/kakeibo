import { useEffect, useState } from 'react';
import type { Entry } from './db/types';
import { navigate, useRoute, type TabKey } from './router';
import { ToastHost } from './components/Toast';
import { UpdateBanner } from './components/UpdateBanner';
import { EntrySheet } from './components/EntrySheet';
import { HomeScreen } from './screens/HomeScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SavingsScreen } from './screens/SavingsScreen';
import { ChartsScreen } from './screens/ChartsScreen';
import { todayYmd } from './lib/date';
import { applyRecurring } from './db/recurringRepo';
import { showToast } from './components/Toast';

const TABS: { key: TabKey; icon: string; label: string; title: string }[] = [
  { key: 'home', icon: '🏠', label: 'ホーム', title: '家計簿' },
  { key: 'calendar', icon: '📅', label: 'カレンダー', title: 'カレンダー' },
  { key: 'charts', icon: '📊', label: 'グラフ', title: 'グラフ' },
  { key: 'savings', icon: '💰', label: '貯金', title: '貯金' },
  { key: 'settings', icon: '⚙️', label: '設定', title: '設定' },
];

export function App() {
  const route = useRoute();
  const [sheet, setSheet] = useState<{ entry?: Entry; date?: string } | null>(null);
  const [day, setDay] = useState(todayYmd);

  // 開いたとき・戻ってきたときに、日が来た固定の収入・支出を入れる
  useEffect(() => {
    const run = () =>
      applyRecurring(todayYmd())
        .then((n) => n > 0 && showToast(`固定の収入・支出を${n}件記録しました`))
        .catch(() => undefined);
    run();
    const onVisible = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // 画面が変わったら先頭へスクロール
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name]);

  const openNew = (date?: string) => {
    setSheet({ date });
  };
  const edit = (entry: Entry) => setSheet({ entry });
  const tab = TABS.find((t) => t.key === route.name)!;

  return (
    <div className="screen has-tabbar">
      <header className="app-header">
        <h1>{tab.title}</h1>
      </header>

      <main className="content">
        {route.name === 'home' ? (
          <HomeScreen onEdit={edit} />
        ) : route.name === 'calendar' ? (
          <CalendarScreen selected={day} onSelect={setDay} onEdit={edit} onAdd={openNew} />
        ) : route.name === 'charts' ? (
          <ChartsScreen />
        ) : route.name === 'savings' ? (
          <SavingsScreen />
        ) : (
          <SettingsScreen />
        )}
      </main>

      <button className="fab" aria-label="記録する" onClick={() => openNew(route.name === 'calendar' ? day : undefined)}>
        ＋
      </button>

      <nav className="tabbar" aria-label="タブ">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${t.key === route.name ? 'active' : ''}`}
            aria-current={t.key === route.name ? 'page' : undefined}
            onClick={() => navigate({ name: t.key }, { replace: true })}
          >
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      {sheet && <EntrySheet entry={sheet.entry} initialDate={sheet.date} onClose={() => setSheet(null)} />}
      <ToastHost />
      <UpdateBanner />
    </div>
  );
}
