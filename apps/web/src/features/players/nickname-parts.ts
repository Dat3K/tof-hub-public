import {isBlankText} from '@tof-hub/contracts';

const graphemes=new Intl.Segmenter(undefined,{granularity:'grapheme'});
const ignorable=/^\p{Default_Ignorable_Code_Point}+$/u;
const blankSegment=(text:string)=>isBlankText(text)||ignorable.test(text);

/** Annotate blank runs without rewriting the raw nickname or splitting visible emoji/letter graphemes. */
export function nicknameParts(nickname:string) {
  const parts:{text:string;blank:boolean}[]=[];
  let leading=true;
  for(const {segment} of graphemes.segment(nickname)) {
    const invisible=blankSegment(segment);
    // Ordinary spaces within a readable name remain ordinary spaces; leading ones need a visible label.
    const blank=invisible&&(segment!==' '||leading);
    const previous=parts[parts.length-1];
    if(previous?.blank===blank)previous.text+=segment;
    else parts.push({text:segment,blank});
    if(!invisible)leading=false;
  }
  return parts;
}
