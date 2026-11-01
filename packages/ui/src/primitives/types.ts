import type { ReactNode, ReactElement, RefObject, MouseEvent, KeyboardEvent, ButtonHTMLAttributes, HTMLAttributes } from 'react';
import type { Locale } from '@tof-hub/i18n';

// Common Theme & Gaming Variant Contracts
export type RarityVariant = 'ssr' | 'sr' | 'r' | 'n';

export type ElementVariant = 'phys' | 'physical' | 'flame' | 'frost' | 'volt' | 'altered';

export type RoleVariant = 'dps' | 'tank' | 'benediction' | 'defense' | 'support';

export type PropertyVariant = 'attack' | 'defense' | 'assist' | 'function' | 'survive';

// Button Types
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'gold'
  | 'accent'
  | 'danger'
  | 'ghost'
  | 'outline';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  href?: string;
  target?: string;
  rel?: string;
}

export interface IconButtonProps extends ButtonProps {
  'aria-label': string;
}

// Badge Types
export type BadgeVariant =
  | RarityVariant
  | ElementVariant
  | RoleVariant
  | PropertyVariant
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  dot?: boolean;
  rounded?: 'default' | 'full' | 'sm';
}

// Tabs Types
export type TabsOrientation = 'horizontal' | 'vertical';
export type TabsVariant = 'pills' | 'underline' | 'neon';

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: TabsOrientation;
  children: ReactNode;
}

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  variant?: TabsVariant;
  children: ReactNode;
  'aria-label'?: string;
}

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: ReactNode;
  icon?: ReactNode;
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  children: ReactNode;
}

// Toggle / Switch Types
export interface ToggleProps {
  id?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'cyan' | 'amber' | 'emerald' | 'purple';
  label?: ReactNode;
  description?: ReactNode;
  className?: string;
  'aria-label'?: string;
}

// Skeleton Types
export type SkeletonVariant = 'text' | 'rectangular' | 'circular' | 'card';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  aspectRatio?: string;
}

// Spinner Types
export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerVariant = 'default' | 'primary' | 'gold' | 'white';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  'aria-label'?: string;
}

// Empty State Types
export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

// Modal Types
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'picker';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: ModalSize;
  appearance?: 'default' | 'tool' | 'table';
  /** Reserve the top of the viewport, keeping the dialog below a fixed header. */
  viewportTopInset?: number;
  /** Focus this control when opening; otherwise focus the panel. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
  showCloseButton?: boolean;
  className?: string;
  overlayClassName?: string;
  ariaLabel?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

export interface ModalHeaderProps extends HTMLAttributes<HTMLDivElement> {
    actions?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export interface ModalTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export interface ModalBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export interface ModalFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

// Dialog Confirmation Types
export interface DialogProps extends Pick<ModalProps, 'appearance' | 'viewportTopInset'> {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  type?: 'info' | 'warning' | 'danger' | 'success';
  variant?: 'info' | 'warning' | 'danger' | 'success';
  isLoading?: boolean;
}

// Lightbox Types
export interface LightboxAnimation {
  /** Verified animated rendition; static src remains the poster/PNG download. */
  src: string;
  gifSrc: string;
}

export interface LightboxImage {
  src: string;
  webpSrc?: string;
  animation?: LightboxAnimation;
  alt?: string;
  title?: string;
  caption?: string;
}

export interface LightboxProps {
  variant?: 'default' | 'art';
  locale?: Locale;
  isOpen: boolean;
  onClose: () => void;
  src?: string;
  webpSrc?: string;
  animation?: LightboxAnimation;
  showPngDownload?: boolean;
  alt?: string;
  title?: string;
  caption?: string;
  downloadName?: string;
  downloadPngLabel?: string;
  downloadWebpLabel?: string;
  images?: LightboxImage[];
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  zoomable?: boolean;
  resolution?: string;
  resolutionMeta?: string;
  fileSize?: string;
  gameFile?: string;
  copyPathLabel?: string;
  copiedLabel?: string;
  zoomLabel?: string;
  closeLabel?: string;
  resolutionLabel?: string;
  fileSizeLabel?: string;
  gameFileLabel?: string;
}

// Tooltip Types
export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  placement?: TooltipPlacement;
  delayMs?: number;
    /** Close/cancel on trigger actions and suppress reopening until pointer leave or keyboard blur. */
    dismissOnAction?: boolean;
  className?: string;
  disabled?: boolean;
  /** Render outside clipping containers and keep the popup within the viewport. */
  portal?: boolean;
  /** Reserve space above portal popups, for example below a fixed header. */
  viewportTopInset?: number;
  /** Control visibility; omit to use the default hover and focus behavior. */
  open?: boolean;
  /** Notify a controlling parent when hover, focus, or Escape changes visibility. */
  onOpenChange?: (open: boolean) => void;
  /** Allow pointer interaction and text selection inside the popup. */
  interactive?: boolean;
  /**
   * Horizontal alignment of a top/bottom portal popup: `center` over the trigger (default) or `end`, its right edge on
   * the trigger's right edge so it opens leftwards (a trigger at the right edge of a card).
   */
  align?: 'center' | 'end';
}
