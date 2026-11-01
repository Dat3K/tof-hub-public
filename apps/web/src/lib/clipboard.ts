/**
 * The one way pages copy a string (IDs, names, labels): the Clipboard API,
 * then a hidden `textarea` with `execCommand` for origins where it is
 * unavailable (LAN HTTP). Resolves `true` when the text was accepted,
 * `false` otherwise; never throws. Callers keep their own "copied" flags,
 * messages and timeouts — those differ per page on purpose.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea below (e.g. denied permission).
  }
  if (typeof document === 'undefined') return false;
  const helper = document.createElement('textarea');
  helper.value = text;
  helper.setAttribute('readonly', 'readonly');
  helper.style.position = 'fixed';
  helper.style.top = '-9999px';
  helper.style.opacity = '0';
  document.body.appendChild(helper);
  helper.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(helper);
  }
}
