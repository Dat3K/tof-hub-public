import type { Locale } from '@tof-hub/i18n';
import { InfoCard, InfoNote, InfoRow, InfoRows, SectionHeading, ToolInfoModal } from '@/components/tool-rail/tool-info-modal';
import { formatNumber } from '@/lib/i18n/format';
import { localeText } from '@/lib/i18n/text';
import styles from './titan-help.module.css';

type Text = ReturnType<typeof localeText>;

export const titanHelpTitle = (t: Text) => t('How to use the Titan calculator', 'Как пользоваться калькулятором титанки');

export function TitanHelp({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const t = localeText(locale);
  const number = (value: number) => formatNumber(value, locale, { minimumFractionDigits: 2 });
  const exampleGain = formatNumber(13 / 12 - 1, locale, { style: 'percent', maximumFractionDigits: 2, signDisplay: 'always' });

  return (
    <ToolInfoModal isOpen onClose={onClose} eyebrow={t('Titan calculator', 'Калькулятор титанки')}
      title={titanHelpTitle(t)} closeLabel={t('Close')}
      intro={t('Use your damage record to find the Titan upgrades that help your build most.',
        'По записи урона калькулятор подберёт свойства титанки, которые дадут наибольший прирост вашему билду.')}>
      <div className={styles.guide} tabIndex={0}>
        <InfoCard>
          <SectionHeading>1. {t('Weapon damage', 'Урон по оружию')}</SectionHeading>
          <InfoRows>
            <InfoRow title={t('Capture one table per weapon', 'Снимите таблицу каждого оружия')}>
              {t('Use the same build and battle conditions for all screenshots. Select each weapon in Total DMG and keep the top summary, the weapon list on the left, and the full table through Total in the frame.',
                'Используйте один билд и одинаковые условия боя для всех скриншотов. В Total DMG по очереди выбирайте оружие. Оставьте в кадре верхнюю сводку, список оружия слева и таблицу целиком до строки Total.')}
            </InfoRow>
            <InfoRow title={t('Paste or drop screenshots', 'Вставьте или перетащите скриншоты')}>
              {t('Paste with Ctrl+V or ⌘V, drop a file, or use Choose screenshots. Automatic import tries to match the weapon and otherwise fills a free card. To replace a specific screenshot, select its card first or use Replace.',
                'Вставьте скриншот через Ctrl+V или ⌘V, перетащите файл либо нажмите «Выбрать скриншоты». При автоимпорте калькулятор ищет оружие и при необходимости заполняет свободную карточку. Для замены выберите нужную карточку или нажмите «Заменить».')}
            </InfoRow>
            <InfoRow title={t('Check the recognized values', 'Сверьте распознанные числа')}>
              {t('Compare the marked rows with the original. Fill any missing Final DMG values, including zeroes. If the marked values are already correct, use Confirm Final DMG. Manual entry accepts numbers such as 252.8k, 490.2m, and 28.19g.',
                'Сверьте отмеченные строки с оригиналом. Заполните пропуски в итоговом уроне, в том числе нули. Если отмеченные числа верны, нажмите «Подтвердить итоговый урон». Вручную можно вводить значения вида 252,8k, 490,2m и 28,19g.')}
            </InfoRow>
          </InfoRows>
        </InfoCard>
        <InfoCard>
          <SectionHeading>2. {t('Titan worn during the parse', 'Титанка на момент парса')}</SectionHeading>
          <InfoRows>
            <InfoRow title={t('Enter the levels you actually wore', 'Укажите уровни, с которыми был сделан парс')}>
              {t('After screenshot import, provide the Titan levels used in that battle. Paste the game stats or the Titan total-levels block from Tools Build. You can also load this browser’s saved build with From Build or enter the summed levels with Edit Titan levels.',
                'После импорта урона укажите уровни титанки из того же боя. Вставьте скриншот статов из игры или блок суммарных уровней из Tools Build. Также можно нажать «Из билдера» для сохранённой в этом браузере сборки или ввести суммы через «Изменить уровни титанки».')}
            </InfoRow>
            <InfoRow title={t('Review all six properties', 'Проверьте все шесть свойств')}>
              {t('Use the total level for each property across your gear. If the screenshot missed a level, correct it and confirm the six values. If you fought without Titan, confirm zeroes.',
                'Для каждого свойства укажите сумму уровней по экипировке. Если распознавание пропустило уровень, исправьте его и подтвердите все шесть значений. Если сделали парс без титанки, подтвердите нули.')}
            </InfoRow>
          </InfoRows>
        </InfoCard>
        <InfoNote label={t('Load example', 'Загрузить пример')} tone="sky">
          {t('The example replaces the current inputs with three checked damage tables and the Titan used in that parse. Open Screenshot examples on the right to see what to capture.',
            'Пример подставляет три проверенные таблицы урона и титанку из этого парса вместо текущих данных. Чтобы увидеть нужные области кадра, откройте «Примеры скриншотов» справа.')}
        </InfoNote>
        <InfoCard>
          <SectionHeading>{t('How damage is calculated', 'Как рассчитывается урон')}</SectionHeading>
          <InfoRows>
            <InfoRow title={t('Remove the worn Titan bonuses', 'Снятие бонусов исходной титанки')}>
              {t('The model sums the five Final DMG rows across weapons and divides each damage type by its worn Titan multiplier. If the entered build has Weak Point levels, this step treats the bonus as active in the original parse.',
                'Модель суммирует пять строк итогового урона по оружию и делит каждый тип урона на множитель исходной титанки. Если у исходной сборки есть уровни Weak Point, на этом шаге бонус считается активным в парсе.')}
            </InfoRow>
            <InfoRow title={t('Apply candidate bonuses by damage type', 'Пересчёт по типам урона')}>
              {t('Normal Attack, Dodge, Skill and Discharge boost their own rows. Damage Boost applies to all five rows, including Passive. Weak Point also applies to all five rows in the active scenario.',
                'Обычная атака, уклонение, навык и разряд усиливают каждый свой тип урона. Damage Boost действует на все пять типов, включая пассивный. В сценарии с Weak Point его бонус также применяется ко всем пяти типам.')}
            </InfoRow>
            <InfoRow title={t('Check the equipment slots', 'Проверка слотов экипировки')}>
              {t('The ranking tests combinations of the strongest obtainable Titan rolls for each slot. Worn and edited sets can have weaker rolls or empty slots, as long as the total levels can be assigned to legal pieces.',
                'Для рейтинга калькулятор перебирает сочетания максимальных доступных роллов титанки по слотам. Исходная и своя сборки могут содержать роллы ниже максимума и пустые слоты, если уровни реально распределить по предметам.')}
            </InfoRow>
          </InfoRows>
        </InfoCard>
        <InfoCard>
          <SectionHeading>{t('A worked example with one damage type', 'Пример для одного типа урона')}</SectionHeading>
          <InfoRows>
            <InfoRow title={t('Damage without Titan', 'Урон без титанки')} formula={`12g ÷ ${number(1.2)} = 10g`}>
              {t('Divide the recorded 12g by the multiplier of the worn Titan.', 'Делим 12g из парса на множитель исходной титанки.')}
            </InfoRow>
            <InfoRow title={t('Forecast with a new set', 'Прогноз с новым набором')} formula={`10g × ${number(1.3)} = 13g`}>
              {t('Apply the multiplier of the new set to the same 10g.', 'Применяем множитель нового набора к тем же 10g.')}
            </InfoRow>
            <InfoRow title={t('Compared with worn Titan', 'К вашей титанке')} formula={`(13g ÷ 12g − 1) × 100% ≈ ${exampleGain}`} />
          </InfoRows>
        </InfoCard>
        <InfoNote label={t('Model assumptions', 'Допущения модели')}>
          {t('Titan factors are multiplied. For example, +20% and +10% give a combined factor of 1.32. The Weak Point forecasts cover two cases, zero or full application of the bonus.',
            'Множители титанки перемножаются. Например, +20% и +10% дают общий множитель 1,32. Прогноз Weak Point показывает два случая — бонус действует на весь урон или не срабатывает вовсе.')}
        </InfoNote>
        <InfoCard>
          <SectionHeading>{t('Read the two rankings', 'Как читать два рейтинга')}</SectionHeading>
          <InfoRows>
            <InfoRow title={t('Without Weak Point', 'Без уязвимых мест')}>
              {t('Use this column when Weak Point does not apply. It ranks sets without Weak Point levels. The comparison also switches off Weak Point for the Titan you wore.',
                'Используйте эту колонку для боёв, где Weak Point не срабатывает. В рейтинге здесь наборы без уровней Weak Point, а исходная титанка сравнивается с выключенным бонусом Weak Point.')}
            </InfoRow>
            <InfoRow title={t('With Weak Point', 'С уязвимыми местами')}>
              {t('This column applies the Weak Point bonus throughout the modeled fight and includes sets with that property.',
                'В этой колонке Weak Point действует весь расчётный бой, поэтому в рейтинг могут попасть наборы с этим свойством.')}
            </InfoRow>
            <InfoRow title={t('Two different percentages', 'От чего считаются проценты')}>
              {t('The large percentage compares the selected set with the Titan you wore, in the same Weak Point scenario. Behind best shows the difference from the first-place set in that column.',
                'Крупный процент сравнивает выбранный набор с вашей титанкой в том же сценарии Weak Point. «Отставание от лучшего» показывает разницу с первым местом этой колонки.')}
            </InfoRow>
            <InfoRow title={t('Used in parse', 'Было в парсе')}>
              {t('This marks a ranked set whose six levels match the original Titan. Your choice marks the set you are comparing. Select the same row again to return to first place.',
                'Этой меткой отмечен набор, у которого все шесть уровней совпали с исходной титанкой. «Ваш выбор» отмечает набор для сравнения. Нажмите на ту же строку ещё раз, чтобы вернуться к первому месту.')}
            </InfoRow>
            <InfoRow title={t('Edit this set', 'Изменить этот набор')}>
              {t('Change the total levels to test a set you can build. Compare it with the selected rank and the best set. The equipment list shows one possible way to assign your edited levels.',
                'Поменяйте суммарные уровни, чтобы проверить набор, который можете собрать. Редактор покажет разницу с выбранным местом и с лидером. В списке экипировки появится один из способов распределить ваши уровни по слотам.')}
            </InfoRow>
          </InfoRows>
        </InfoCard>
        <InfoCard>
          <SectionHeading>{t('Damage distribution', 'Распределение урона')}</SectionHeading>
          <InfoRows>
            <InfoRow title={t('Recorded, normalized, and projected damage', 'Урон из парса, без титанки и по прогнозу')}>
              {t('Switch between the recorded Final DMG, damage with the worn bonuses removed, and the forecast for the current set in either scenario. Each bar shows that damage type’s share of the total in the selected view.',
                'Переключайтесь между итоговым уроном из парса, уроном после снятия бонусов и прогнозом для выбранного набора в одном из двух сценариев. Каждая полоса показывает долю типа урона в текущем режиме.')}
            </InfoRow>
            <InfoRow title={t('Stat tooltips', 'Подсказки к свойствам')}>
              {t('Hover over a property to see its effect on the affected damage types and on the whole build. The tooltip compares the same set with those property levels removed.',
                'Наведите на свойство, чтобы увидеть его вклад в соответствующий тип урона и во весь билд. Подсказка сравнивает тот же набор с вариантом, из которого убрали указанные уровни свойства.')}
            </InfoRow>
          </InfoRows>
        </InfoCard>
        <InfoCard>
          <SectionHeading>{t('Parse summary', 'Сводка парса')}</SectionHeading>
          <InfoRows>
            <InfoRow title={t('How to read the shares', 'Как читать доли урона')}>
              {t('All cells use the same denominator, the total damage of the imported weapons with Titan bonuses removed. If a weapon has 30% in the Skill column, that weapon’s skills contributed 30% of the whole total.',
                'У всех ячеек одна база — суммарный урон загруженного оружия после снятия бонусов титанки. Если в столбце навыка стоит 30%, навыки этого оружия дали 30% всего урона в таблице.')}
            </InfoRow>
            <InfoRow title={t('Other damage (optional)', 'Прочий урон (необязательно)')}>
              {t('Import the Others tab from the same parse if you want an overall gain that includes it. The model adds this damage unchanged to both sides of the comparison. The chart and summary use weapon damage.',
                'Загрузите вкладку Others из того же парса, если хотите учесть её в общем приросте. Модель прибавляет этот урон без изменений к обоим вариантам сравнения. График и сводка показывают урон оружия.')}
            </InfoRow>
            <InfoRow title={t('Element and resonance', 'Стихия и резонанс')}>
              {t('The summary suggests an element from the recognized loadout. Use the icon in the top right to change the label for the whole parse. Damage shares and forecasts use the same values after a label change.',
                'Сводка предлагает стихию по распознанному набору оружия. Значок справа сверху позволяет поменять подпись для всего парса. После смены подписи доли и прогнозы остаются теми же.')}
            </InfoRow>
            <InfoRow title={t('Download PNG', 'Скачать PNG')}>
              {t('The image includes the weapon shares, the top three sets in each scenario, and any valid set you chose for comparison.',
                'В изображение попадут доли оружия, три лучших набора для каждого сценария и выбранный вами набор, если его можно собрать.')}
            </InfoRow>
          </InfoRows>
        </InfoCard>
      </div>
    </ToolInfoModal>
  );
}
