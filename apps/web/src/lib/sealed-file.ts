import { type Locale, translateUiText} from '@tof-hub/i18n';
/**
 * Browser-side first gate of the Tools uploads (.tofbuild, .tofwish, .tofplayers): a file is checked before it is
 * read in full or sent. The server repeats the same gate and then authenticates the content (AES-GCM).
 *
 * Checks: extension, size, the format signature at the start (`{"format":"<format>"`) and the closing brace at the
 * end, so another tool's file, a ZIP, an image or a cut-off download is refused at once. Formats, limits and the
 * signature come from `SEALED_FILES` in @tof-hub/contracts, shared with the API.
 */
import {SEALED_FILES,SEALED_FILE_SIGNATURE,type SealedFileKind} from '@tof-hub/contracts';

export type SealedFileProblem='extension'|'size'|'format'|'incomplete';

export async function checkSealedFile(file:File,kind:SealedFileKind):Promise<SealedFileProblem|null> {
  const {extension,format,maxBytes}=SEALED_FILES[kind];
  const json=file.name.toLowerCase().endsWith('.json');
  if(!json&&!file.name.toLowerCase().endsWith(extension))return 'extension';
  if(file.size===0||file.size>maxBytes)return 'size';
  const head=await file.slice(0,256).text();
  if(json?!head.trimStart().startsWith('{'):SEALED_FILE_SIGNATURE.exec(head)?.[1]!==format)return 'format';
  const tail=await file.slice(Math.max(0,file.size-64)).text();
  if(!tail.trimEnd().endsWith('}'))return 'incomplete';
  return null;
}

/** One message per problem, shared by every upload. */
export function sealedFileMessage(problem:SealedFileProblem,kind:SealedFileKind,locale:Locale) {
  const {extension,maxBytes}=SEALED_FILES[kind];
  const size=`${Math.round(maxBytes/1024/1024)} MiB`;
  const ru=locale==='ru';
  return {
    extension:ru?`Нужен файл .json или ${extension}.`:`Choose a .json or ${extension} file.`,
    size:ru?`Файл пустой или больше ${size.replace('MiB','МиБ')}.`:`The file is empty or larger than ${size}.`,
    format:ru?`Некорректный JSON или файл ${extension}.`:`Invalid JSON or ${extension} file.`,
    incomplete:ru?'Файл обрезан: сохраните его в приложении заново.':translateUiText('The file is cut off: save it again in the capture app.', locale),
  }[problem];
}
