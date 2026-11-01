import type {CSSProperties} from 'react';
import type {CharacterTitleStyle} from './types';

/** Profile-header title in the game's presentation: its text colour, and its plate art when the game draws one. */
export function CharacterTitlePlate({label,style}:{label:string;style?:CharacterTitleStyle}) {
  if(!style?.plate)return <b data-hint-overflow style={style?.color?{color:style.color}:undefined}>{label}</b>;
  return <b className="character-title-plate" style={{'--title-plate':`url("${style.plate}")`,color:style.color} as CSSProperties}>
    <span data-hint-overflow>{label}</span>
  </b>;
}
