import {useState} from 'react';
import {translateUiText, type Locale} from '@tof-hub/i18n';
import type {ItemTradeData} from '@tof-hub/contracts';
import {resolveMediaUrl} from './items-domain';
import styles from './items.module.css';

export function ItemsTradeCells({trade, locale, format, percentFormat}: {
  trade?: ItemTradeData;
  locale: Locale;
  format: Intl.NumberFormat;
  percentFormat: Intl.NumberFormat;
}) {
  const [failedIcon, setFailedIcon] = useState<string>();
  if (!trade) {
    const unknown = translateUiText('Unknown', locale);
    return <>
      <td className={styles.tradeReference}><span className={styles.tradeUnknown} role="img" aria-label={unknown} title={unknown}>—</span></td>
      <td className={styles.tradeRange} />
    </>;
  }
  const unavailable = translateUiText('Cannot be listed', locale);
  const icon = resolveMediaUrl(trade.currency.icon ?? '');
  const currency = icon && icon !== failedIcon
    ? <img src={icon} className={styles.tradeCurrencyIcon} alt={trade.currency.name} width={20} height={20}
        loading="lazy" onError={() => setFailedIcon(icon)} />
    : <span className={styles.tradeCurrencyName}>{trade.currency.name}</span>;
  const source = trade.bandSource === 'server'
    ? [translateUiText('Observed on the Overseas server', locale), trade.observedAt].filter(Boolean).join(' · ')
    : undefined;

  return (
    <>
      <td className={styles.tradeReference}>
        <span className={styles.tradeMobileLabel}>{translateUiText('Reference price', locale)}</span>
        <span className={styles.tradeAmount}>
          {format.format(trade.basePrice)} {currency}
        </span>
      </td>
      <td className={styles.tradeRange} title={source}>
        {trade.canList ? (
          <>
            <span className={styles.tradeMobileLabel}>{translateUiText('Listing band', locale)}</span>
            <span className={styles.tradeAmount}>{format.format(trade.minPrice)}–{format.format(trade.maxPrice)} {currency}</span>
            <span className={styles.tradeRatios}>
              {percentFormat.format(trade.minRatio - 1)} / {percentFormat.format(trade.maxRatio - 1)}
            </span>
          </>
        ) : (
          <span className={styles.tradeUnavailable} role="img" aria-label={unavailable} title={unavailable}>×</span>
        )}
      </td>
    </>
  );
}
