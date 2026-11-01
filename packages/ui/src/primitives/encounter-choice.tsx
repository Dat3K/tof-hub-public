'use client';

import type { ButtonHTMLAttributes } from 'react';

type EncounterChoiceProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-pressed'> & {
  label: string;
  /** A null image reserves an unavailable portrait; omitted images make a text-only choice. */
  image?: string | null;
  active: boolean;
};

/** Compact encounter choice shared by the boss and raid selectors. */
export function EncounterChoice({label, image, active, className = '', ...props}: EncounterChoiceProps) {
  return <button {...props} type="button" className={`encounter-choice ${className}`.trim()}
    aria-pressed={active} aria-label={props['aria-label'] ?? label} title={props.title ?? label}>
    {image ? <img className="encounter-choice__avatar" src={image} alt="" width={22} height={22} loading="eager"
      onError={event => {event.currentTarget.style.display = 'none';}} />
      : image === null ? <span className="encounter-choice__empty" aria-hidden="true" /> : null}
    <span className="encounter-choice__name">{label}</span>
  </button>;
}
