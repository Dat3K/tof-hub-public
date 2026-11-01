import type {BuildLocale} from './types';
import {translateUiText} from '@tof-hub/i18n';

/**
 * Profile portrait when the avatar is unknown: a neutral silhouette, never another avatar. A captured id the cosmetics
 * catalog does not have yet (a newer client's avatar) is named in the hint until the pipeline publishes it.
 */
export function AvatarFallback({avatarId,locale}:{avatarId?:string;locale:BuildLocale}) {
  const hint=avatarId?translateUiText('Avatar {0} is not in the catalog yet',locale).replace('{0}',avatarId):undefined;
  return <span className="media-placeholder profile-placeholder" data-hint={hint}>
    <svg viewBox="0 0 24 24" width="60%" height="60%" aria-hidden="true" fill="currentColor"><circle cx="12" cy="8" r="4.2"/><path d="M3.5 21c.8-4.6 4.2-7 8.5-7s7.7 2.4 8.5 7z"/></svg>
  </span>;
}
