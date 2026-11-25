import { useEffect, useState } from 'react';

const EVENT = 'kakeibo-toast';

type ToastAction = { label: string; onClick: () => void };
type ToastMsg = { text: string; action?: ToastAction };

/** 画面の下に短いメッセージを出す。action を渡すと「元に戻す」などのボタンが付き、少し長く出る */
export function showToast(text: string, action?: ToastAction): void {
  window.dispatchEvent(new CustomEvent<ToastMsg>(EVENT, { detail: { text, action } }));
}

export function ToastHost() {
  const [msg, setMsg] = useState<(ToastMsg & { key: number }) | null>(null);
  useEffect(() => {
    const on = (e: Event) => setMsg({ ...(e as CustomEvent<ToastMsg>).detail, key: Date.now() });
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.action ? 5000 : 1800);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return (
    <div key={msg.key} className={`toast ${msg.action ? 'toast-action' : ''}`} role="status">
      <span>{msg.text}</span>
      {msg.action && (
        <button
          type="button"
          className="toast-btn"
          onClick={() => {
            msg.action!.onClick();
            setMsg(null);
          }}
        >
          {msg.action.label}
        </button>
      )}
    </div>
  );
}
