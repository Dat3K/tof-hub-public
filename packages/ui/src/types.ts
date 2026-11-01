export interface LoadingStateProps {
  message?: string;
  submessage?: string;
  variant?: 'spinner' | 'skeleton' | 'minimal';
  fullPage?: boolean;
  className?: string;
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  errorCode?: string | number;
  digest?: string;
  onRetry?: () => void;
  retryLabel?: string;
  homeHref?: string;
  homeLabel?: string;
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  details?: string;
  className?: string;
}

export interface NotFoundLinkItem {
  href: string;
  label: string;
  description?: string;
  badge?: string;
}

export interface NotFoundStateProps {
  title?: string;
  description?: string;
  homeHref?: string;
  homeLabel?: string;
  links?: NotFoundLinkItem[];
  className?: string;
}
