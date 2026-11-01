'use client';
import { fillText } from '@/lib/i18n/text';
import {useId,useRef,useState,type ClipboardEvent,type DragEvent} from 'react';
import {Button,useToast} from '@tof-hub/ui';
import {localeText} from '@/lib/i18n/text';
import {recognizeGearImage,type OcrRejection} from './gear-ocr-engine';
import type {BuildLocale} from './types';
import styles from './build.module.css';

/** "Import from screenshot" for the random or the augmentation stats of one gear piece. */
/** `onText` applies the recognised text to the form and returns how many stats it filled. */
export function GearOcrImport({locale,onText}:{locale:BuildLocale;onText:(text:string)=>number}) {
  const t=localeText(locale),input=useRef<HTMLInputElement>(null),[reading,setReading]=useState(false),[dragging,setDragging]=useState(false);
  const {notify}=useToast(),noticeId=useId();
  const reject=(reason:OcrRejection|'engine',retryAfterMs?:number)=>{
    const seconds=Math.max(1,Math.ceil((retryAfterMs??0)/1000));
    const text={
      type:t('Use a PNG, JPEG or WebP screenshot.'),
      size:t('The image is larger than 6 MB.'),
      dimensions:t('The image is too small or too large to read.'),
      busy:t('Another screenshot is being read.'),
      gap:fillText(t('Wait {0} s before the next screenshot.', 'Подождите {0} с до следующего скриншота.'), [seconds]),
      rate:fillText(t('Too many screenshots. Try again in {0} s.', 'Слишком много скриншотов. Повторите через {0} с.'), [seconds]),
      engine:t('The text reader could not start. Check the connection and try again.')
    }[reason];
    notify(text,{id:noticeId,tone:'error'});
  };
  async function read(file:File|undefined) {
    if(!file||reading)return;
    setReading(true);
    try {
      const result=await recognizeGearImage(file);
      if(!result.ok){reject(result.reason,result.retryAfterMs);return;}
      const filled=onText(result.text);
      if(!filled){notify(t('No stats found in the screenshot. Crop it to the stats section and try again.'),{id:noticeId,tone:'error'});return;}
      notify(fillText(t('Filled {0} stat(s). Check the values.', 'Заполнено статов: {0}. Проверьте значения.'), [filled]),{id:noticeId,tone:'info'});
    } finally {setReading(false);}
  }
  const pasted=(event:ClipboardEvent<HTMLDivElement>)=>{
    const file=Array.from(event.clipboardData.files).find(item=>item.type.startsWith('image/'))??
      Array.from(event.clipboardData.items).find(item=>item.type.startsWith('image/'))?.getAsFile()??undefined;
    if(file){event.preventDefault();void read(file);}
  };
  const dropped=(event:DragEvent<HTMLDivElement>)=>{
    event.preventDefault();setDragging(false);
    const file=Array.from(event.dataTransfer.files).find(item=>item.type.startsWith('image/'));
    if(file)void read(file);
  };
  return <div className={styles.gearOcr}>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label={t('Stats screenshot')}
      onChange={event=>{void read(event.target.files?.[0]);event.target.value='';}}/>
    <div className={styles.gearOcrDrop} data-dragging={dragging} tabIndex={0} role="group" aria-label={t('Drop, paste or choose a screenshot')}
      onPaste={pasted} onDragEnter={event=>{event.preventDefault();setDragging(true);}} onDragOver={event=>event.preventDefault()} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setDragging(false);}} onDrop={dropped}>
    <Button variant="outline" size="sm" disabled={reading} onClick={()=>input.current?.click()}
      data-hint={t('The image is read in your browser; it is not uploaded or stored.')}>
      {reading?t('Reading…'):t('Import from screenshot')}
    </Button>
    <span className={styles.gearOcrHint}>{t('Drop or paste Ctrl+V')}</span></div>
  </div>;
}
