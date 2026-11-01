import { type Locale } from '@tof-hub/i18n';
import {Button} from '@tof-hub/ui';
import {InfoCard,InfoNote,SectionHeading,ToolInfoModal} from '@/components/tool-rail/tool-info-modal';
import {localeText} from '@/lib/i18n/text';

export function UpdateDataModal({isOpen,onClose,locale,onApp}:{isOpen:boolean;onClose:()=>void;locale:Locale;onApp:(kind:'build'|'players')=>void}) {
  const t=localeText(locale);
  const ways=[
    {kind:'build' as const,title:t('Capture your own build'),text:t('Use the capture app on your PC, save your character as .tofbuild and upload the file to update their data.'),note:'PS. Log out on Hykros before launching the app.',button:t('How to collect .tofbuild')},
    {kind:'players' as const,title:t('Ask another player'),text:t('Someone else can use the app, open your profile in the game and upload .tofplayers. They do not need access to your account.'),button:t('How to collect .tofplayers')},
  ];
  return <ToolInfoModal isOpen={isOpen} onClose={onClose} eyebrow={t('Ranking')} title={t('Update data')} intro={t('Outdated data or a missing character? There are two ways to update the ranking.')} closeLabel={t('Close')}>
    <section className="grid gap-3 sm:grid-cols-2" aria-label={t('Ways to update')}>
      {ways.map(way=><InfoCard key={way.kind} className="flex flex-col gap-3"><SectionHeading>{way.title}</SectionHeading><p className="text-sm leading-relaxed text-slate-400">{way.text}</p>{way.note&&<p className="text-xs font-medium text-amber-300/80">{way.note}</p>}<div className="mt-auto pt-1"><Button variant="secondary" size="sm" onClick={()=>onApp(way.kind)}>{way.button}</Button></div></InfoCard>)}
    </section>
    <InfoNote>{t('For a fair ranking, only files from the capture app are accepted. Both buttons open the existing app guide with download and upload instructions.')}</InfoNote>
  </ToolInfoModal>;
}
