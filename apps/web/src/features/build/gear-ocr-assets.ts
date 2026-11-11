import workerPath from 'tesseract.js/dist/worker.min.js?ocr-asset';
import languagePath from '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?ocr-asset';
// Tesseract picks the core for the browser's WebAssembly capabilities.
import 'tesseract.js-core/tesseract-core-lstm.wasm.js?ocr-asset';
import 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?ocr-asset';
import 'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js?ocr-asset';

export function getGearOcrAssets() {
  const directory = new URL('.', new URL(languagePath, window.location.href)).href;
  return { workerPath, corePath: directory, langPath: directory };
}
