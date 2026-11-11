import {useCallback, useState} from 'react';
import {createPortal} from 'react-dom';
import type {TradeStationRulesReference} from '@tof-hub/contracts';
import {translateUiText, type Locale} from '@tof-hub/i18n';
import {Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle, Tooltip} from '@tof-hub/ui';
import {useSiteHeaderInset} from '@/components/site-shell/use-site-header-inset';
import styles from './items.module.css';

export function ItemsTradeRules({rules, locale}: {rules: TradeStationRulesReference; locale: Locale}) {
  const [isOpen, setIsOpen] = useState(false);
  const headerInset = useSiteHeaderInset(isOpen);
  const close = useCallback(() => setIsOpen(false), []);
  const title = translateUiText('Trade Station rules', locale);

  return (
    <>
      <Tooltip content={title} portal delayMs={600} dismissOnAction>
        <button type="button" className={styles.tradeHelp} aria-label={title} aria-haspopup="dialog" onClick={() => setIsOpen(true)}>
          <span aria-hidden="true">?</span>
        </button>
      </Tooltip>
      {isOpen && createPortal(
        <Modal isOpen onClose={close} size="lg" appearance="table" viewportTopInset={headerInset}>
          <ModalHeader showCloseButton={false}>
            <ModalTitle>{title}</ModalTitle>
            <p className={styles.tradeRulesMeta}>
              {translateUiText('Observed on the Overseas server', locale)} <time dateTime={rules.observedAt}>{rules.observedAt}</time>
              {' · '}{translateUiText('Server time', locale)} {rules.serverTimeZone}
            </p>
          </ModalHeader>
          <ModalBody className={styles.tradeRulesBody}>
            <div lang="en">
              {rules.en.sections.map(section => (
                <section key={section.title} className={styles.tradeRulesSection}>
                  <h3>{section.title}</h3>
                  <ol>{section.items.map(item => <li key={item}>{item}</li>)}</ol>
                </section>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={close}>{translateUiText('Close', locale)}</Button>
          </ModalFooter>
        </Modal>,
        document.body,
      )}
    </>
  );
}
