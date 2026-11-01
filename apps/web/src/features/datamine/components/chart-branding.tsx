/**
 * Shared datamine chart branding: title typography and the `@kritik` author mark
 * (same mark and letter spacing as the Build card footer and Wish exports).
 * Used by Sequential, Bygone and Origin of War charts, both SVG and canvas.
 */
export const CHART_FONT_FAMILY = "Manrope, 'Segoe UI', Arial, sans-serif";
export const CHART_TITLE_FONT_SIZE = 24;
export const CHART_TITLE_FONT_WEIGHT = 700;
export const CHART_WATERMARK_TEXT = '@kritik';

/** Canvas `font` shorthand for chart titles. */
export const CHART_TITLE_CANVAS_FONT = `${CHART_TITLE_FONT_WEIGHT} ${CHART_TITLE_FONT_SIZE}px ${CHART_FONT_FAMILY}`;

/** Author mark inside an SVG chart; anchored at its bottom-left baseline. */
export function ChartWatermark({
  x,
  y,
  fontSize = 18,
  fill,
}: {
  x: number;
  y: number;
  fontSize?: number;
  fill: string;
}) {
  return (
    <text
      x={x}
      y={y}
      fill={fill}
      fillOpacity="0.75"
      fontFamily={CHART_FONT_FAMILY}
      fontSize={fontSize}
      fontWeight="600"
      letterSpacing={fontSize / 9}
    >
      {CHART_WATERMARK_TEXT}
    </text>
  );
}

/** Same mark on a canvas chart; restores the context state afterwards. */
export function drawChartWatermark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fill: string,
  fontSize: number = 18
): void {
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = fill;
  ctx.font = `600 ${fontSize}px ${CHART_FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${fontSize / 9}px`;
  }
  ctx.fillText(CHART_WATERMARK_TEXT, x, y);
  ctx.restore();
}
