/**
 * Tower of Fantasy - Shared combat and stat formulas
 * Pure math evaluated from CritFormula.json curve tables.
 *
 * Implements:
 * - Crit denominator: denom(L) = ax2[L]*L^2 + bx[L]*L + c[L] (At L100: 28213)
 * - Resist constant: K(L) = denom(L) / 2 (At L100: 14106)
 * - Enemy Resistance: resist% = X / (X + K)
 * - Effective HP: effHP = HP * (X + K) / K = HP * (1 + X/K)
 * - Empirical Shred Floor: 0.7 (-30% max resistance shred)
 */

(function (root) {
  // Constant: Empirical blueprint-baked shred floor
  const EMPIRICAL_SHRED_FLOOR = 0.7;

  // Canonical piecewise polynomial curve definitions for CritFormula.json
  // Segments represent: L <= 9, 10..40, 41..80, 81..100+
  const DEFAULT_CRIT_CURVES = [
    { maxLvl: 9, a: 0.0, b: 150.0, c: 0.0 },
    { maxLvl: 40, a: -4.0, b: 408.0, c: -2078.0 },
    { maxLvl: 80, a: -0.163, b: 285.0, c: -3215.0 },
    { maxLvl: Infinity, a: -3.71, b: 1151.0, c: -49787.0 }
  ];

  /**
   * Calculates crit denominator denom(L) for a player level L.
   * @param {number} [level=100]
   * @param {Object} [customCurves]
   * @returns {number}
   */
  function critDenom(level = 100, customCurves = null) {
    const L = typeof level === 'number' && Number.isFinite(level) && level > 0 ? level : 100;

    if (customCurves) {
      if (customCurves.byLevel && customCurves.byLevel[String(L)] != null) {
        return Number(customCurves.byLevel[String(L)]);
      }
      if (Array.isArray(customCurves.segments)) {
        const seg = customCurves.segments.find((s) => L <= s.maxLvl) || customCurves.segments[customCurves.segments.length - 1];
        if (seg) {
          return Math.round(seg.a * L * L + seg.b * L + seg.c);
        }
      }
    }

    const seg = DEFAULT_CRIT_CURVES.find((s) => L <= s.maxLvl) || DEFAULT_CRIT_CURVES[DEFAULT_CRIT_CURVES.length - 1];
    const denom = seg.a * L * L + seg.b * L + seg.c;
    return Math.max(1, Math.round(denom));
  }

  /**
   * Calculates resistance denominator constant K(L) = denom(L) / 2.
   * At level 100, K = 14106.
   * @param {number} [level=100]
   * @param {Object} [customCurves]
   * @returns {number}
   */
  function resistK(level = 100, customCurves = null) {
    const denom = critDenom(level, customCurves);
    return Math.floor(denom / 2);
  }

  /**
   * Evaluates enemy resistance percentage and audit breakdown.
   * Formula: resist% = X / (X + K)
   * @param {number} strengthX - Enemy strength / resistance value X
   * @param {number} [level=100] - Player level L
   * @param {Object} [customCurves]
   * @returns {{ X: number, K: number, level: number, rawResistPct: number, resistPct: number, effectiveMultiplier: number, effectiveHpMult: number }}
   */
  function calcResist(strengthX, level = 100, customCurves = null) {
    const L = typeof level === 'number' && Number.isFinite(level) && level > 0 ? level : 100;
    const X = typeof strengthX === 'number' && Number.isFinite(strengthX) && strengthX >= 0 ? strengthX : 0;
    const K = resistK(L, customCurves);
    const rawResistPct = X > 0 ? X / (X + K) : 0;
    const resistPct = rawResistPct;
    const effectiveMultiplier = 1.0 + X / K;

    return {
      X,
      K,
      level: L,
      rawResistPct,
      resistPct,
      effectiveMultiplier,
      effectiveHpMult: effectiveMultiplier
    };
  }

  /**
   * Formats numbers into compact suffixes (e.g. 1.2M, 3.55B).
   * @param {number} val
   * @returns {string}
   */
  function formatCompact(val) {
    if (val === null || val === undefined || !Number.isFinite(val)) return '0';
    const abs = Math.abs(val);
    if (abs >= 1e12) return (val / 1e12).toFixed(2).replace(/\.00$/, '') + 'T';
    if (abs >= 1e9) return (val / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
    if (abs >= 1e6) return (val / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
    if (abs >= 1e3) return (val / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(val));
  }

  /**
   * Calculates effective HP given base HP and enemy strength X.
   * Formula: effHP = HP * (X + K) / K
   * @param {number} baseHp
   * @param {number} strengthX
   * @param {number} [level=100]
   * @param {Object} [customCurves]
   */
  function calcEffectiveHp(baseHp, strengthX, level = 100, customCurves = null) {
    if (typeof baseHp !== 'number' || !Number.isFinite(baseHp) || baseHp <= 0) {
      return {
        hp: 0,
        X: 0,
        K: resistK(level, customCurves),
        resistPct: 0,
        effectiveMultiplier: 1,
        effectiveHp: 0,
        effectiveHpFormatted: '0'
      };
    }

    const audit = calcResist(strengthX, level, customCurves);
    const effectiveHpValue = baseHp * audit.effectiveMultiplier;

    return {
      hp: baseHp,
      X: audit.X,
      K: audit.K,
      resistPct: audit.resistPct,
      effectiveMultiplier: audit.effectiveMultiplier,
      effectiveHp: effectiveHpValue,
      effectiveHpFormatted: formatCompact(effectiveHpValue)
    };
  }

  /**
   * Calculates player crit chance percentage.
   * Formula: crit% = critStat / denom(L)
   * @param {number} critStat
   * @param {number} [level=100]
   * @param {Object} [customCurves]
   */
  function calcCrit(critStat, level = 100, customCurves = null) {
    const L = typeof level === 'number' && Number.isFinite(level) && level > 0 ? level : 100;
    const stat = typeof critStat === 'number' && Number.isFinite(critStat) && critStat >= 0 ? critStat : 0;
    const denom = critDenom(L, customCurves);
    const critPct = denom > 0 ? stat / denom : 0;

    return {
      critStat: stat,
      level: L,
      denom,
      critPct,
      critPctFormatted: (critPct * 100).toFixed(2) + '%'
    };
  }

  /**
   * Applies the empirical shred floor (cannot reduce enemy resist multiplier below 0.7).
   * @param {number} multiplier
   * @returns {number}
   */
  function applyShredFloor(multiplier) {
    if (typeof multiplier !== 'number' || !Number.isFinite(multiplier)) return EMPIRICAL_SHRED_FLOOR;
    return Math.max(EMPIRICAL_SHRED_FLOOR, multiplier);
  }

  /**
   * Formats a stat number with thousand separators (en-US locale).
   * @param {number|string} val
   * @returns {string|null}
   */
  function formatStatNumber(val) {
    if (val === null || val === undefined) return null;
    const n = Number(val);
    if (!Number.isFinite(n)) return String(val);
    return n.toLocaleString('en-US');
  }

  /**
   * Shorthand backward-compatible effective HP computation.
   */
  function effectiveHp(baseHp, strengthX, level = 100) {
    if (typeof baseHp !== 'number' || !Number.isFinite(baseHp) || baseHp <= 0) return null;
    const audit = calcResist(strengthX, level);
    return Math.round(baseHp * audit.effectiveHpMult);
  }

  const TofFormulas = {
    EMPIRICAL_SHRED_FLOOR,
    DEFAULT_CRIT_CURVES,
    critDenom,
    resistK,
    getResistK: resistK,
    calcResist,
    calcEffectiveHp,
    effectiveHp,
    calcCrit,
    applyShredFloor,
    formatStatNumber,
    formatCompact
  };

  root.TofFormulas = TofFormulas;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TofFormulas;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
