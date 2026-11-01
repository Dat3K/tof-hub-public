'use client';
import { Dialog } from '@tof-hub/ui';
import { useI18n } from '@/lib/i18n';
import { FEEDBACK_COPY } from './feedback-copy';

export default function FeedbackInvitation({ onClose, onAccept }: { onClose: () => void; onAccept: () => void }) {
  const { locale } = useI18n(), t = FEEDBACK_COPY[locale];
  return <Dialog isOpen onClose={onClose} onConfirm={onAccept} title={t.promptTitle} description={t.promptDescription}
    confirmLabel={t.promptAccept} cancelLabel={t.close} appearance="tool" />;
}
