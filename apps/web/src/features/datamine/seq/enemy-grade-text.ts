/** Presentation of the raw localized grade line, without deriving any ratings. */
export function parseEnemyGradeText(text: string) {
  const lines = text.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  const ratings = lines.at(-1)!.split(/[,，]/).map(part => {
    const match = part.trim().match(/^(.+?)(?:\s*[—–:]\s*|\s+)(SSS|SS|S|[A-F])$/u);
    if (!match || /[<>]/.test(match[1])) return null;
    return {label: match[1].trim(), grade: match[2]};
  });
  if (!ratings.length || ratings.some(rating => !rating)) return null;
  return {summary: lines.slice(0, -1).join('\n'), ratings: ratings.filter(rating => rating !== null)};
}
