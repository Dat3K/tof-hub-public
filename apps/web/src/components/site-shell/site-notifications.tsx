'use client';
import { localeText } from '@/lib/i18n/text';
import type {ReactNode} from 'react';
import {ToastProvider} from '@tof-hub/ui';
import {useLocale} from '@/lib/i18n';

export function SiteNotifications({children}:{children:ReactNode}) {
  const {locale}=useLocale();
  return <ToastProvider label={localeText(locale)('Notifications', 'Уведомления')} closeLabel={localeText(locale)('Dismiss notification', 'Закрыть уведомление')}>{children}</ToastProvider>;
}
