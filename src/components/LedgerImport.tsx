import { useState } from 'react';
import { importLedger } from '../db/ledgerRepo';
import { decodeLedger, LEDGER_ERROR_MESSAGE } from '../lib/ledger';
import { formatMd } from '../lib/date';
import { Sheet } from './Sheet';
import { showToast } from './Toast';

/** 例：11/20(金) 21:05 */
export function formatExportedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${formatMd(ymd)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function importText(text: string): Promise<string | undefined> {
  const p = decodeLedger(text);
  if ('error' in p) return LEDGER_ERROR_MESSAGE[p.error];
  await importLedger(p);
  showToast(`旅行${p.trips.length}件・支出${p.entries.length}件を取り込みました`);
  return undefined;
}

/** 「たびメモから取り込む」ボタン。クリップボードを読めなければ貼り付け欄を出す */
export function LedgerImportButton({ className = 'btn btn-primary btn-block' }: { className?: string }) {
  const [paste, setPaste] = useState<{ error?: string } | null>(null);

  const run = async () => {
    let text = '';
    try {
      text = (await navigator.clipboard?.readText?.()) ?? '';
    } catch {
      // 読めない（許可されなかった・対応していない）ときは貼り付け欄で
    }
    if (!text.trim()) return setPaste({});
    const error = await importText(text);
    if (error) setPaste({ error });
  };

  return (
    <>
      <button type="button" className={className} onClick={run}>
        ✈️ たびメモから取り込む
      </button>
      {paste && <PasteSheet error={paste.error} onClose={() => setPaste(null)} />}
    </>
  );
}

function PasteSheet({ error: initialError, onClose }: { error?: string; onClose: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(initialError ?? '');

  const run = async () => {
    const e = await importText(text);
    if (e) setError(e);
    else onClose();
  };

  return (
    <Sheet
      title="たびメモから取り込む"
      onClose={onClose}
      action={
        <button type="button" className="btn btn-primary btn-small" onClick={run} disabled={!text.trim()}>
          取り込む
        </button>
      }
    >
      <div className="form">
        {error && (
          <p className="errors" role="alert">
            {error}
          </p>
        )}
        <ol className="steps small">
          <li>たびメモの「設定」で「💴 家計簿に送る」を押す</li>
          <li>下の欄を長押しして「ペースト」</li>
          <li>右上の「取り込む」を押す</li>
        </ol>
        <textarea
          className="paste-area"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError('');
          }}
          placeholder="ここに貼り付け"
          rows={5}
          aria-label="たびメモからコピーしたデータ"
        />
      </div>
    </Sheet>
  );
}
