/** One geometry for the preview and its PNG export. */
export const BUILD_CARD_WIDTH=1760;
export const BUILD_CARD_HEIGHT=830;
export const BUILD_EXPORT_SCALE=2;
export const BUILD_SUMMARY_COLUMNS=14;
export function buildSummaryColumns(count:number) {return Math.max(1,Math.min(count,count<=BUILD_SUMMARY_COLUMNS?BUILD_SUMMARY_COLUMNS:10));}
/** Reserve a full line for every row so preview and export never clip stats. */
export function buildCardHeight(summaryCount:number) {
  return BUILD_CARD_HEIGHT+Math.max(0,Math.ceil(summaryCount/buildSummaryColumns(summaryCount))-1)*18;
}
