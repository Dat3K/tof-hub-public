import {formatValue} from './presentation';
import type {BuildLocale} from './types';
import styles from './gear-roll-quality.module.css';

/** The known pre-Titan roll quality, with the same percentage and emphasis on Build and Optimizer. */
export function GearRollQuality({value,locale,className}:{value:number|null;locale:BuildLocale;className?:string}) {
  return value===null?null:<span className={[styles.quality,className].filter(Boolean).join(' ')} data-roll-quality> · {formatValue(value,true,locale,0)}</span>;
}
