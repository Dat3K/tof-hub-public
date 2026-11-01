import {gameAsset, STAT_GRADE_ICONS} from '@tof-hub/game-assets';
import styles from './game-stat-grade.module.css';

export function GameStatGrade({grade, className = '', title}: {grade: string; className?: string; title?: string}) {
  const icon = Object.hasOwn(STAT_GRADE_ICONS, grade) ? STAT_GRADE_ICONS[grade] : undefined;
  return icon
    ? <img className={`${styles.grade} ${className}`} src={gameAsset(icon)} alt={grade} title={title} />
    : <span className={`${styles.grade} ${styles.fallback} ${className}`} title={title}>{grade}</span>;
}
