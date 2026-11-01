export function getAdaptiveLuckColor(value: number, midpoint: number, maximum: number): string {
  const colorStops = [
    [248, 113, 113],
    [251, 191, 36],
    [163, 230, 53],
    [52, 211, 153],
  ];
  const valueRatio = Math.min(1, Math.max(0, value / maximum));
  const midpointRatio = midpoint / maximum;
  const midpointPosition = 2 / 3;
  const scaled = valueRatio <= midpointRatio
    ? (valueRatio / midpointRatio) * midpointPosition
    : midpointPosition + ((valueRatio - midpointRatio) / (1 - midpointRatio)) * (1 - midpointPosition);
  const stopPosition = scaled * (colorStops.length - 1);
  const segment = Math.min(colorStops.length - 2, Math.floor(stopPosition));
  const segmentRatio = Math.min(1, stopPosition - segment);
  const color = colorStops[segment].map((start, index) =>
    Math.round(start + (colorStops[segment + 1][index] - start) * segmentRatio)
  );
  return `rgb(${color.join(' ')})`;
}

/** 50/50 win rate in percent: red below, amber at the expected 50%, green above. */
export function getWinRateColor(rate: number): string {
  return getAdaptiveLuckColor(rate, 50, 100);
}

export function getLuckMultiplierPresentation(multiplier: number, shimmerClassName: string) {
  return multiplier > 3
    ? { className: `${shimmerClassName} transition-colors duration-300`, style: undefined }
    : {
        className: 'font-semibold transition-colors duration-300',
        style: { color: getAdaptiveLuckColor(multiplier, 1, 3) },
      };
}
