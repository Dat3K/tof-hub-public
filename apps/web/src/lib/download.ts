/**
 * The one way pages hand the visitor a file (PNG exports, JSON and spreadsheet exports): an attached `<a download>`
 * clicked once. Object URLs are released after a delay, since some browsers start the download asynchronously.
 */
export function downloadUrl(url: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadBlob(contents: BlobPart | Blob, type: string, fileName: string): void {
  const blob = contents instanceof Blob ? contents : new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  downloadUrl(url, fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** PNG data URL (canvas snapshot) to the visitor's downloads. */
export function downloadPng(dataUrl: string, fileName: string): void {
  downloadUrl(dataUrl, fileName);
}

/** Canvas element as a PNG file. Same bytes as `canvas.toDataURL('image/png')` handed to `downloadPng`. */
export function downloadCanvasPng(canvas: HTMLCanvasElement, fileName: string): void {
  downloadPng(canvas.toDataURL('image/png'), fileName);
}

/**
 * JSON payload as a `.json` file (`JSON.stringify(data, null, 2)`,
 * `application/json;charset=utf-8`). Revokes the object URL at once, like the
 * datamine exporters it replaces — unlike `downloadBlob`, which waits a second.
 */
export function downloadJson(data: unknown, fileName: string): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
