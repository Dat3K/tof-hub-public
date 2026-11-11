import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Button, Lightbox } from '@tof-hub/ui';
import type { Locale } from '@tof-hub/i18n';
import { fillText, localeText } from '@/lib/i18n/text';
import { categoryLabel } from './damage-labels';
import { DAMAGE_CATEGORIES, type DamageCategory } from './model';
import { formatDamageValue, parseDamageValue, totalMatches, type ParsedRow, type ParsedTable } from './parse-table';
import styles from './titan-calculator.module.css';

const COLUMNS = ['base', 'final', 'multiplier'] as const;
type Column = typeof COLUMNS[number];
type RowKey = DamageCategory | 'total';
export interface RowEntry {
  values: Record<Column, string>;
  source?: ParsedRow;
}
export type WeaponEntry = Partial<Record<RowKey, RowEntry>>;

const emptyValues = { base: '', final: '', multiplier: '' };
const damageText = (value: number | null) => value === null ? '' : formatDamageValue(value, 12);

export function fromParsedTable(table: ParsedTable): WeaponEntry {
  const weapon: WeaponEntry = {};
  for (const category of [...DAMAGE_CATEGORIES, 'total'] as const) {
    const row = category === 'total' ? table.totalRow : table.rows[category];
    if (row) weapon[category] = {
      values: {
        base: damageText(row.base),
        final: damageText(row.final),
        multiplier: row.multiplier === null ? '' : row.multiplier.toFixed(2),
      },
      source: row,
    };
  }
  return weapon;
}

export const finalValue = (row?: RowEntry) => row?.values.final.trim() ? parseDamageValue(row.values.final) : null;

export function editWeaponRow(weapon: WeaponEntry, key: RowKey, column: Column, value: string): WeaponEntry {
  const row = weapon[key];
  return { ...weapon, [key]: {
    values: { ...(row?.values ?? emptyValues), [column]: value },
    source: column === 'final' ? undefined : row?.source,
  } };
}

export function confirmDamageRows(weapon: WeaponEntry): WeaponEntry {
  return Object.fromEntries(Object.entries(weapon).map(([key, row]) =>
    [key, row.source?.status === 'check' ? { values: row.values } : row]));
}

const isImage = (file: File) => file.type.startsWith('image/');
export function clipboardImages(clipboard: DataTransfer | null): File[] {
  if (!clipboard) return [];
  const files = Array.from(clipboard.files).filter(isImage);
  return files.length ? files : Array.from(clipboard.items).flatMap(item => {
    const file = item.getAsFile();
    return file && isImage(file) ? [file] : [];
  });
}

export function ScreenshotDrop({ onFiles, className, children }: {
  onFiles: (files: File[]) => void;
  className: string;
  children: ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  const acceptDrag = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  };
  return <div
    className={className}
    data-dragging={dragging}
    onDragEnter={acceptDrag}
    onDragOver={acceptDrag}
    onDragLeave={event => {
      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false);
    }}
    onDrop={event => {
      if (!event.dataTransfer.files.length) return;
      event.preventDefault();
      setDragging(false);
      onFiles(Array.from(event.dataTransfer.files));
    }}
  >{children}</div>;
}

export function ScreenshotPicker({ label, onFiles, multiple = false, disabled = false, primary = false }: {
  label: string;
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  primary?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return <>
    <input
      ref={input}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      multiple={multiple}
      disabled={disabled}
      hidden
      aria-label={label}
      onChange={event => {
        onFiles(Array.from(event.currentTarget.files ?? []));
        event.currentTarget.value = '';
      }}
    />
    <Button variant={primary ? 'primary' : 'outline'} size="sm" disabled={disabled} onClick={() => input.current?.click()}>
      {label}
    </Button>
  </>;
}

export function ScreenshotPreview({ screenshot, locale }: {
  screenshot: { url: string; name: string };
  locale: Locale;
}) {
  const t = localeText(locale);
  const [open, setOpen] = useState(false);
  const label = t('View screenshot', 'Открыть скриншот');
  return <>
    <button className={styles.preview} type="button" onClick={() => setOpen(true)}>
      <img src={screenshot.url} alt="" />
      <span><b>{label}</b><span title={screenshot.name}>{screenshot.name}</span></span>
    </button>
    {open && <Lightbox isOpen onClose={() => setOpen(false)} src={screenshot.url} alt={label} locale={locale} showPngDownload={false} />}
  </>;
}

export function WeaponTable({ weapon, title, pending, imported, selected, locale, onEdit, onConfirm }: {
  weapon: WeaponEntry;
  title: string;
  pending: boolean;
  imported: boolean;
  selected: boolean;
  locale: Locale;
  onEdit: (category: RowKey, column: Column, value: string) => void;
  onConfirm: () => void;
}) {
  const t = localeText(locale);
  const noteId = useId();
  const labels = {
    base: t('Base DMG', 'Баз. урон'),
    final: t('Final DMG', 'Итог. урон'),
    multiplier: t('Multiplier', 'Множитель'),
  };
  const finals = DAMAGE_CATEGORIES.map(category => finalValue(weapon[category]));
  const sum = finals.reduce<number>((total, value) => total + (value ?? 0), 0);
  const matches = totalMatches(finals.map(value => value ?? 0), finalValue(weapon.total));
  const checks = DAMAGE_CATEGORIES.filter(category => weapon[category]?.source?.status === 'check'
    || (weapon[category]?.values.final.trim() && finalValue(weapon[category]) === null)).length;
  const repaired = DAMAGE_CATEGORIES.filter(category => weapon[category]?.source?.status === 'corrected').length;
  const missing = finals.filter(value => value === null).length;

  function cells(key: RowKey, label: string) {
    const row = weapon[key];
    const status = row?.source?.status;
    const checkedByTotal = row?.source?.checkedByTotal;
    const note = status === 'corrected'
      ? t('Repaired by the row check', 'Исправлено при проверке строки')
      : checkedByTotal ? t('Final DMG agrees with Total', 'Итоговый урон сходится с Total') : undefined;
    return <>
      <th scope="row">{label}</th>
      {COLUMNS.map(column => {
        const value = row?.values[column] ?? '';
        const invalid = Boolean(value.trim() && (column === 'multiplier'
          ? !/^\d+(?:[.,]\d+)?$/.test(value.trim())
          : parseDamageValue(value) === null));
        const check = column === 'final' && (status === 'check' || (imported && key !== 'total' && !value.trim()));
        return <td key={column} data-final={column === 'final'}>
          <input
            className={styles.cellInput}
            value={value}
            onChange={event => onEdit(key, column, event.target.value)}
            disabled={pending}
            placeholder={key === 'total' && column === 'final' && finals.some(value => value !== null) ? formatDamageValue(sum) : '—'}
            inputMode={column === 'multiplier' ? 'decimal' : 'text'}
            autoComplete="off"
            spellCheck={false}
            aria-label={`${label} · ${labels[column]}`}
            aria-invalid={invalid || check}
            aria-describedby={check ? noteId : undefined}
            title={column === 'final' ? note : undefined}
          />
          {column === 'final' && note && <span className="sr-only">{note}</span>}
        </td>;
      })}
    </>;
  }

  return <>
    <table className={styles.damageTable}>
      <caption className="sr-only">{title}</caption>
      <thead><tr>
        <th scope="col">{t('Type', 'Тип')}</th>
        {COLUMNS.map(column => <th key={column} scope="col" data-final={column === 'final'}>
          {column === 'multiplier' ? <><span className={styles.multiplierLabel}>{labels[column]}</span><span className={styles.multiplierSymbol} aria-hidden>×</span></> : labels[column]}
        </th>)}
      </tr></thead>
      <tbody>
        {DAMAGE_CATEGORIES.map(category => <tr key={category} data-status={weapon[category]?.source?.status}>
          {cells(category, categoryLabel(category, t))}
        </tr>)}
      </tbody>
      <tfoot><tr>{cells('total', t('Total', 'Всего'))}</tr></tfoot>
    </table>
    <div className={styles.tableNote} id={noteId} role="status">
      {checks > 0 && <span className={styles.warning}>{fillText(t('Check rows: {0}', 'Проверьте строки: {0}'), [checks])}</span>}
      {imported && missing > 0 && <span className={styles.warning}>{fillText(t('Missing Final DMG: {0}', 'Не заполнено строк итогового урона: {0}'), [missing])}</span>}
      {matches === false && <span className={styles.warning}>{fillText(t('Rows sum to {0}. Check Total.', 'Сумма строк — {0}. Проверьте итог.'), [formatDamageValue(sum)])}</span>}
      {matches && missing === 0 && <span className={styles.totalOk}>{t('Total verified', 'Итог сходится')}</span>}
      {repaired > 0 && <span className={styles.repaired}>{fillText(t('Repaired: {0}', 'Исправлено: {0}'), [repaired])}</span>}
      {!imported && matches === null && <span>{t('Enter Final DMG in k, m or g.', 'Введите итоговый урон в k, m или g.')}</span>}
      {selected && <span className={styles.pasteTarget}>{t('Paste here', 'Вставка сюда')}</span>}
    </div>
    {imported && !pending && missing === 0 && checks > 0 && <div className={styles.damageConfirm}>
      <Button size="sm" variant="outline" onClick={event=>{
        event.currentTarget.closest('article')?.querySelector<HTMLButtonElement>('h3 button')?.focus({preventScroll:true});
        onConfirm();
      }}>{t('Confirm Final DMG', 'Подтвердить итоговый урон')}</Button>
    </div>}
  </>;
}
