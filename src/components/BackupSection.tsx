import { useState } from 'react';
import { backupFileName, backupSummary, checkBackup, exportBackup, restoreBackup } from '../lib/backup';
import { formatExportedAt } from './LedgerImport';
import { showToast } from './Toast';

const LAST_KEY = 'kakeibo.lastBackupAt';

function loadLast(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

async function saveJsonFile(name: string, data: unknown, title: string): Promise<void> {
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  // 共有メニューが使えないときはファイルとして保存
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast('ファイルを保存しました');
}

/** 設定の「バックアップ」 */
export function BackupSection() {
  const [last, setLast] = useState(loadLast);

  const doExport = async () => {
    const b = await exportBackup();
    await saveJsonFile(backupFileName(), b, '家計簿のバックアップ');
    try {
      localStorage.setItem(LAST_KEY, b.exportedAt);
    } catch {
      // 覚えられなくてもよい
    }
    setLast(b.exportedAt);
  };

  const doImport = async (f: File) => {
    let json: unknown;
    try {
      json = JSON.parse(await f.text());
    } catch {
      return showToast('JSON ファイルとして読めませんでした');
    }
    const c = checkBackup(json);
    if (!c.ok) return showToast(c.message);
    if (!confirm(`${formatExportedAt(c.backup.exportedAt)} のバックアップ（${backupSummary(c.backup)}）を読み込みます。\n今のデータは全部置き換わります。よろしいですか？`)) return;
    await restoreBackup(c.backup);
    showToast('バックアップを読み込みました');
  };

  return (
    <section className="card">
      <h3 className="card-title">バックアップ</h3>
      <p className="muted small">データはこのスマホの中にだけ保存されています。機種変更やデータ消去に備えて、ときどき書き出しておいてください。旅行の支出のもとのデータは、たびメモのバックアップに入っています。</p>
      <p className="small">前回の書き出し：{last ? formatExportedAt(last) : <span className="over">まだありません</span>}</p>
      <button type="button" className="btn btn-primary btn-block" onClick={doExport}>
        ⬇ 書き出す（JSON ファイル）
      </button>
      <label className="btn btn-ghost btn-block file-btn">
        ⬆ バックアップから読み込む
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void doImport(f);
          }}
        />
      </label>
    </section>
  );
}
