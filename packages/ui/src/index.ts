// @tof-hub/ui — Shared UI primitives, contracts, and boundary utilities
export { DemoCallToAction } from './primitives/demo-call-to-action';
export type { DemoCallToActionProps } from './primitives/demo-call-to-action';
export {Toast,ToastMirror,ToastProvider,useToast} from './primitives/toast';
export type {ToastOptions} from './primitives/toast';
export { ExportButton } from './primitives/export-button';
export type { ExportButtonProps } from './primitives/export-button';
export { GameBadge } from './primitives/game-badge';
export type { GameBadgeProps } from './primitives/game-badge';
export { GameRichText, formatGameRichText } from './primitives/game-rich-text';
export type { GameRichTextOptions, GameTextLink } from './primitives/game-rich-text';

export {
  sanitizeError,
  sanitizeErrorMessage,
  logSanitizedError,
} from './utils/sanitize-error';
export type {
  SanitizedErrorInfo,
} from './utils/sanitize-error';

export { useDismiss } from './utils/use-dismiss';
export type { DismissReason, UseDismissOptions } from './utils/use-dismiss';
export { useBatchedList } from './utils/use-batched-list';
export type { UseBatchedListOptions, UseBatchedListReturn } from './utils/use-batched-list';

export type {
  LoadingStateProps,
  ErrorStateProps,
  NotFoundStateProps,
  NotFoundLinkItem,
} from './types';

// Catalog Controls & Filter Bar Primitives
export {
  FilterChip,
  FilterGroup,
  CatalogSearch,
  ServerModeSwitcher,
  ModeSwitcher,
  getStoredServerMode,
  setStoredServerMode,
  CatalogSort,
  SortListbox,
  useSortListbox,
  CatalogCounter,
  ResetFiltersButton,
  CatalogControls,
} from './catalog';

export type {
  ServerMode,
  FilterVariant,
  FilterChipProps,
  FilterGroupProps,
  CatalogSearchProps,
  ServerModeSwitcherProps,
  ModeSwitcherProps,
  ModeSwitcherOption,
  ModeSwitcherTone,
  SortOption,
  CatalogSortProps,
  SortListboxProps,
  UseSortListboxOptions,
  CatalogCounterProps,
  ResetFiltersButtonProps,
  CatalogControlsProps,
} from './catalog';

// General & Sci-Fi UI Primitives
export {
  Button,
  IconButton,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Toggle,
  Skeleton,
  Spinner,
  LoadingState,
  EmptyState,
  TransparencyCheckerboard,
} from './primitives';

export type {
  RarityVariant,
  ElementVariant,
  RoleVariant,
  PropertyVariant,
  ButtonVariant,
  ButtonSize,
  ButtonProps,
  IconButtonProps,
  BadgeVariant,
  BadgeSize,
  BadgeProps,
  TabsOrientation,
  TabsVariant,
  TabsProps,
  TabsListProps,
  TabsTriggerProps,
  TabsContentProps,
  ToggleProps,
  SkeletonVariant,
  SkeletonProps,
  SpinnerSize,
  SpinnerVariant,
  SpinnerProps,
  EmptyStateProps,
  TransparencyCheckerboardProps,
} from './primitives';

// Overlays, Modals, Dialogs, Lightbox & Tooltips
export {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalClose,
  ModalBody,
  ModalFooter,
  Dialog,
  Lightbox,
  MediaLightbox,
  Tooltip,
  HintLayer,
} from './overlay';

export type {
  ModalSize,
  ModalProps,
  ModalHeaderProps,
  ModalTitleProps,
  ModalBodyProps,
  ModalFooterProps,
  DialogProps,
  LightboxImage,
  LightboxProps,
  TooltipPlacement,
  TooltipProps,
} from './primitives';

// Game Catalog Cards & Grid Primitives
export {
  EntityCard,
  EntityCardArt,
  EntityCardBadges,
  EntityCardRarityBadge,
  EntityCardCornerBadge,
  EntityCardInfo,
  EntityCardTitle,
  EntityCardSubtitle,
  EntityCardDescription,
  EntityCardFooter,
  EntityGrid,
  PickerActionCard,
  Card,
  Panel,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card';

export type {
  EntityCardProps,
  EntityGridProps,
  PickerActionCardProps,
  CardVariant,
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardDescriptionProps,
  CardContentProps,
  CardFooterProps,
} from './card';
export {MatrixSetBadge} from './primitives/matrix-set-badge';
export {Collapsible} from './primitives/collapsible';
export {EncounterChoice} from './primitives/encounter-choice';

export { ProfileAvatar } from './primitives/profile-avatar';
export type { ProfileAvatarImage, ProfileAvatarProps } from './primitives/profile-avatar';
export { EditorialHeader, EditorialMetadata, EditorialSectionHeading } from './primitives/editorial';
export type { EditorialHeaderProps, EditorialMetadataItem, EditorialMetadataProps, EditorialSectionHeadingProps } from './primitives/editorial';
export {revealHorizontalFocus} from './utils/reveal-horizontal-focus';
