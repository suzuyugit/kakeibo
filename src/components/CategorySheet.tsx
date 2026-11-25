import { useState } from 'react';
import type { Category, EntryType } from '../db/types';
import { TRAVEL_CATEGORY } from '../db/db';
import { addCategory, deleteCategory, updateCategory } from '../db/categoryRepo';
import { Sheet } from './Sheet';
import { showToast } from './Toast';

type Props = {
  type: EntryType;
  category?: Category;
  onClose: () => void;
  onSaved?: (id: string) => void;
};

const ICONS_EXPENSE = ['🍙', '🍜', '☕', '🧴', '🚃', '🎮', '🍻', '👕', '💄', '🏠', '💡', '📱', '🔁', '📚', '💊', '🐶', '🎁', '📦'];
const ICONS_INCOME = ['💼', '📮', '🎉', '🎓', '🏦', '🧾', '💰'];

/** カテゴリの追加・編集 */
export function CategorySheet({ type, category, onClose, onSaved }: Props) {
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? (type === 'expense' ? '📦' : '💰'));
  const [hidden, setHidden] = useState(!!category?.hidden);
  const [error, setError] = useState('');
  const travel = category?.id === TRAVEL_CATEGORY;

  const save = async () => {
    if (!name.trim()) return setError('名前を入れてください');
    if (category) {
      await updateCategory(category.id, { name, icon, hidden });
      onSaved?.(category.id);
    } else {
      onSaved?.(await addCategory(type, name, icon));
    }
    onClose();
  };

  const remove = async () => {
    if (!category) return;
    if (!confirm(`「${category.name}」を削除しますか？`)) return;
    if (await deleteCategory(category.id)) {
      showToast('削除しました');
      onClose();
    } else {
      setError('記録や固定の収入・支出で使っているので削除できません。「入力で出さない」にすると選べなくなります。');
    }
  };

  return (
    <Sheet
      title={category ? 'カテゴリを編集' : `${type === 'expense' ? '支出' : '収入'}のカテゴリを追加`}
      onClose={onClose}
      action={
        <button type="button" className="btn btn-primary btn-small" onClick={save}>
          保存
        </button>
      }
    >
      <div className="form">
        {error && (
          <p className="errors" role="alert">
            {error}
          </p>
        )}
        <label className="field">
          <span className="label">名前</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：本" autoFocus={!category} />
        </label>
        <div className="field">
          <span className="label">アイコン</span>
          <div className="icon-pick">
            {(type === 'expense' ? ICONS_EXPENSE : ICONS_INCOME).map((i) => (
              <button key={i} type="button" className={`pick ${icon === i ? 'active' : ''}`} onClick={() => setIcon(i)}>
                {i}
              </button>
            ))}
            <input className="icon-input" value={icon} onChange={(e) => setIcon(e.target.value)} aria-label="好きな絵文字" />
          </div>
        </div>
        {category && !travel && (
          <label className="switch-row">
            <input type="checkbox" role="switch" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
            <span className="switch" aria-hidden="true" />
            <span className="label">入力で出さない（非表示）</span>
          </label>
        )}
        {travel && <p className="muted small">「旅行」は、たびメモから取り込んだ支出が入るカテゴリです。削除や手入力はできません。</p>}
        {category && !travel && (
          <button type="button" className="btn btn-danger-outline btn-block" onClick={remove}>
            このカテゴリを削除
          </button>
        )}
      </div>
    </Sheet>
  );
}
