interface SnapshotLibrary {
  toPng: (node: HTMLElement, options?: Record<string, unknown>) => Promise<string>;
}

declare global {
  interface Window {
    htmlToImage?: SnapshotLibrary;
  }
}

let vendorPromise: Promise<SnapshotLibrary> | null = null;

export function loadDomSnapshot(): Promise<SnapshotLibrary> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.htmlToImage) return Promise.resolve(window.htmlToImage);
  if (vendorPromise) return vendorPromise;
  vendorPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/dom-snapshot.js';
    script.async = true;
    script.onload = () => {
      if (window.htmlToImage) resolve(window.htmlToImage);
      else {
        vendorPromise = null;
        reject(new Error('Export library failed to initialise'));
      }
    };
    script.onerror = () => {
      vendorPromise = null;
      reject(new Error('Export library failed to load'));
    };
    document.head.appendChild(script);
  });
  return vendorPromise;
}

export function carryOverInheritedCustomProperties(source: HTMLElement, clone: HTMLElement): void {
  const carried = new Map<string, string>();
  const computed = window.getComputedStyle(source);
  for (let i = 0; i < computed.length; i++) {
    const name = computed[i];
    if (name.startsWith('--') && !carried.has(name)) carried.set(name, computed.getPropertyValue(name));
  }
  let ancestor: HTMLElement | null = source;
  while (ancestor) {
    const inline = ancestor.style;
    for (let i = 0; i < inline.length; i++) {
      const name = inline[i];
      if (name.startsWith('--') && !carried.has(name)) carried.set(name, inline.getPropertyValue(name));
    }
    ancestor = ancestor.parentElement;
  }
  for (const [name, value] of carried) clone.style.setProperty(name, value);
}

export async function waitForDomSnapshotAssets(root: HTMLElement, options: {freezeAnimations?: boolean} = {}): Promise<void> {
  const borderImages = new Map<string, Promise<string>>();
  await Promise.all([root, ...root.querySelectorAll<HTMLElement>('*')].map(async (node) => {
    if (options.freezeAnimations) {
      node.style.animation = 'none';
      node.style.transition = 'none';
    }
    // html-to-image embeds backgrounds and masks, but leaves border-image URLs
    // external. SVG foreignObject cannot load those resources when rasterized.
    const source = getComputedStyle(node).borderImageSource;
    const url = /^url\(["']?(.*?)["']?\)$/.exec(source)?.[1];
    if (!url || url.startsWith('data:')) return;
    try {
      let loaded = borderImages.get(url);
      if (!loaded) {
        loaded = fetch(url).then(response => {
          if (!response.ok) throw new Error('Border image unavailable');
          return response.blob();
        }).then(blob => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }));
        borderImages.set(url, loaded);
      }
      node.style.borderImageSource = `url("${await loaded}")`;
    } catch {
      // Decorative media failures do not prevent the rest of the card exporting.
    }
  }));
  try {
    await document.fonts?.ready;
  } catch {
    // The system font remains usable when a web font fails.
  }
  await Promise.all(Array.from(root.querySelectorAll('img')).map(async (img) => {
    try {
      if (img.decode) await img.decode();
    } catch {
      // A missing decorative image does not prevent the rest of the card exporting.
    }
  }));
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
}

/** PNG downloads live in lib/download.ts (`downloadPng`); this module keeps only the DOM snapshot itself. */
