import { createLocaleCopies } from '@tof-hub/i18n';
import type { ReactNode } from "react";
import { guideLocaleCopies } from "./guide-rich";

// Editorial guide migrated from legacy datamine/multype/guide/js/multype-guide.js.
const GUIDE_SOURCE = ({
  en: {
    metaTitle: "ToF | Multype Guide",
    metaDesc:
      "Player guide to Tower of Fantasy buff stacking, multiplier categories, and ModuleExtraType in the Multype tool.",
    heroEyebrow: "MULTYPE GUIDE",
    heroTitle: "Buff Stacking & Multipliers",
    heroSubtitle:
      "A player-facing reference on how buff effects stack, which categories multiply, and how to read the Multype data tables.",
    backToTool: "Back to Multype page",
    tocTitle: "ON THIS PAGE",
    tocGroupBasics: "GUIDE",
    tocOverview: "Overview",
    tocRenaming: "How the renaming is built",
    tocTables: "Reading it properly",
    tocSimplified: "Simplified reading",
    permalinkLabel: "Permalink",
    secRenamingTitle: "How the renaming is built",
    renamingP1:
      "These readable names are not hand-typed from guides. The whole game export was scanned; every modifier structure found in the assets becomes a raw row in the dataset.",
    renamingP2: (
      <>
        {"A row is a triple: its module context ("}
        <code>{"ModuleExtraType_*"}</code>
        {"), its attribute / sub-table (e.g. "}
        <code>{"FinalDamageExtraUpMult"}</code>
        {"), and the source buff file. That raw triple is the "}
        <strong>{"Datamined"}</strong>
        {" view."}
      </>
    ),
    renamingP3: (
      <>
        {
          "Then, using the in-game console, each buff is pulled live and its real effect is verified, and a human-readable name is attached. That verified name is the "
        }
        <strong>{"Renamed"}</strong>
        {" / "}
        <strong>{"Combined"}</strong>
        {" view."}
      </>
    ),
    renamingExampleBeforeLabel: "Raw triple (Datamined view):",
    renamingExampleAfterLabel: "Verified readable name (Renamed view):",
    secTablesTitle: "Reading it properly: different tables = different buffs",
    tablesP1: (
      <>
        {"Each table (module × attribute) is its own multiplier bucket. Values "}
        <strong>{"inside"}</strong>
        {" one table add together; "}
        <strong>{"different"}</strong>
        {" tables "}
        <strong>{"multiply"}</strong>
        {"."}
      </>
    ),
    tablesP2: (
      <>
        {"The critical point: two tables can show the "}
        <strong>{"same"}</strong>
        {" display name (“Final Dmg”) and still be "}
        <strong>{"different"}</strong>
        {" categories, because they live under different modules. In game they "}
        <strong>{"multiply"}</strong>
        {
          " even though the label looks identical. The same is true for the elemental tables (Ice / Fire / Volt / Phys attack)."
        }
      </>
    ),
    tablesExampleBadge: "REAL ILLUSTRATION",
    tablesExampleTitle: "Ene A6 10% in two different tables",
    tablesExampleDesc:
      "The exact same buff file appears in two different tables simultaneously. Because these tables are separate multiplier buckets, both bonuses apply and multiply:",
    tablesExampleTable1Label: "Table 1 (Frost Debuff)",
    tablesExampleTable1Desc: "Frost damage debuff (+10%)",
    tablesExampleTable2Label: "Table 2 (Final Dmg Debuff)",
    tablesExampleTable2Desc: "Final damage taken debuff (+10%)",
    tablesMultipliedLabel: "Multiplied",
    tablesExampleFormula:
      "In-game result: (1 + 0.10) × (1 + 0.10) = 1.21× multiplier (Multiplicative, not additive 1.20×)",
    tablesBridgeText:
      "If searching for every buff across complex categories without developer console access feels too demanding, use the simplified template below — it covers 99% of all build and stacking questions (provided the game developers haven't made an anomaly in the data itself).",
    tablesBridgeLink: "Go to Simplified reading",
    secSimplifiedTitle: "Simplified reading",
    simplifiedIntro: (
      <>
        {
          "Almost everything you care about is Final Dmg plus the Elemental Dmg of your element. These split into a few "
        }
        <strong>{"main groups"}</strong>
        {":"}
      </>
    ),
    groupWeaponActiveTitle: "Active weapon buffs",
    groupWeaponActiveLabel: "Weapon active",
    groupWeaponActiveDesc: "Buffs granted actively on a skill press or specific combat action.",
    groupWeaponPassiveTitle: "Passive weapon buffs",
    groupWeaponPassiveLabel: "Weapon passive",
    groupWeaponPassiveDesc: "Buffs granted simply for having the weapon existing in your build.",
    groupMatrixTitle: "Matrices",
    groupMatrixLabel: "Matrix",
    groupMatrixDesc: "Matrix set bonuses and effects, scaling independently of weapons.",
    groupTraitsTitle: "Traits",
    groupTraitsLabel: "Traits",
    groupTraitsDesc:
      "Simulacrum trait enhancements (DPS + support combination), evaluated separately.",
    groupRelicsTitle: "Relics",
    groupRelicsLabel: "Relics",
    groupRelicsDesc: "Relic damage bonuses, partitioned into Final and Elemental categories.",
    groupDebuffsTitle: "Everything else",
    groupDebuffsLabel: "Enemy debuffs / Content buffs",
    groupDebuffsDesc:
      "All external combat modifiers, target debuffs, and content-specific bonuses.",
    simplifiedRuleNoCrossTitle: "The groups do not cross",
    simplifiedRuleNoCrossText: (
      <>
        {"The groups do "}
        <strong>{"not"}</strong>
        {" cross. To compare matrices you do "}
        <strong>{"not"}</strong>
        {
          " need to think about which weapons you run: matrices synergize among themselves by the simple Final Dmg + Elemental Dmg rule and never overlap with weapons. "
        }
        <mark className={"guide-template-highlight"}>
          {"Compare matrices only against matrices"}
        </mark>
        {" and you will be exactly right."}
      </>
    ),
    templateRuleBadge: "Template rule",
    templateRuleMatricesOnly: "Compare matrices only against matrices",
    simplifiedRuleWeaponsTitle: "Weapons: Active vs. Passive",
    simplifiedRuleWeaponsText: "Weapons are a bit harder — read the buff text:",
    simplifiedRuleWeaponsActive: (
      <>
        {"If the buff is granted on a skill press / some action, it is "}
        <strong>{"ACTIVE"}</strong>
        {" (compare among actives)."}
      </>
    ),
    simplifiedRuleWeaponsPassive: (
      <>
        {"If the buff is granted simply for the weapon existing in your build, it is "}
        <strong>{"PASSIVE"}</strong>
        {"."}
      </>
    ),
    simplifiedRuleTraitsTitle: "Traits calculation",
    simplifiedRuleTraitsText: "Traits (the DPS + support combination) are counted separately.",
    simplifiedRuleRelicsTitle: "Relics independence",
    simplifiedRuleRelicsText: (
      <>
        {"Relics: Final and Elemental are counted separately, and relics do "}
        <strong>{"not"}</strong>
        {" combine with traits or matrices."}
      </>
    ),
    simplifiedExceptionTitle: 'Important exception — the "No cathegory / Normal" table',
    simplifiedExceptionText: (
      <>
        {"Those specific relics are "}
        <strong>{"not"}</strong>
        {" bound by the group rules above. Relics appearing in "}
        <code>{"NoModule::FinalDamageExtraUpMult"}</code>
        {
          " (such as Couant, Omnium Shield, Quantum Cloak, and Drone) are simply a separate category that multiplies onto everything. (This is the understandable exception.)"
        }
      </>
    ),
    simplifiedCrossMultiTitle: "How Final & Elemental Dmg multiply across categories",
    simplifiedCrossMultiText: (
      <>
        <p>
          {
            "In the end, all resulting combat damage in your build scales as the product of two fundamental multiplier blocks: "
          }
          <strong>{"Final Dmg × Elemental Dmg"}</strong>
          {"."}
        </p>
        <p>
          {
            "In turn, each of these two blocks is multiplied across its own independent categories: "
          }
          <strong>{"Final Dmg"}</strong>
          {" from matrices multiplies by "}
          <strong>{"Final Dmg"}</strong>
          {" from active weapon buffs, by "}
          <strong>{"Final Dmg"}</strong>
          {" from passive weapon buffs, traits, and relics. In the exact same way, "}
          <strong>{"Elemental Dmg"}</strong>
          {" multiplies across matrices, weapon active, weapon passive, traits, and relics."}
        </p>
      </>
    ),
    simplifiedCrossMultiFormulaMain: "Total Multiplier = Final Dmg × Elemental Dmg",
    simplifiedCrossMultiFormulaFinal: "• Final Dmg: Matrix × Weapon Active × Weapon Passive × Traits × Relics",
    simplifiedCrossMultiFormulaElemental: "• Elemental Dmg: Matrix × Weapon Active × Weapon Passive × Traits × Relics",
    simplifiedElementalAlertTitle:
      "Notice: There are NOT two types of elemental damage in the game!",
    simplifiedElementalAlertP1: (
      <>
        <strong>{"Frost Dmg and Elemental Dmg are one and the same thing"}</strong>
        {
          ' (just as with Flame, Volt, and Physical). The game engine does not possess a separate, standalone "generic elemental damage" category that multiplies on top of your specific element.'
        }
      </>
    ),
    simplifiedElementalAlertP2: (
      <>
        {"If one buff says "}
        <em>{'"Frost Dmg +X%"'}</em>
        {" and another says "}
        <em>{'"Elemental Dmg +Y%"'}</em>
        {
          ", they do not create two distinct multiplying element tiers for a frost weapon — they both belong to the exact same elemental damage bucket within that category."
        }
      </>
    ),
    simplifiedExamplesTitle: "Reference: Four worked examples",
    simplifiedExamplesIntro:
      "These principles are demonstrated across four authoritative reference examples:",
    example1Name: "Shiro A1 against enemy",
    example1Code: "Buff_DartsPhy_SSR_Level1_BeDamageUp.json",
    example2Name: "Thalassic heart",
    example2Code: "Buff_FinBeDMGReduceLvl2_Artifact_SSR_018.json",
    example3Name: "Ene A6 10%",
    example3Code: "Buff_HammerIce_SR_DamageUp_all10_ice2_OS.json",
    example4Name: "Spacetime rift",
    example4Code: "GE_ArtifactSSR005_BeAtkUp.json",
    showcaseBadge: "Live Multype UI",
    subMetaFiles: "FILES",
    subMetaCol: "SUB COLUMN",
    exampleSelectorAria: "Example selector",
    exampleSelectorLabel: "Real verifiable example",
    exampleTypeCountLabel: "Normal (Type Count)",
    comparisonDataminedBadge: "Datamined view (Raw files)",
    comparisonArrowText: "In-game console verification & rename",
    comparisonRenamedBadge: "Renamed view (Readable name)",
    boardCategoryMeta: "5 category groups · scroll right →",
    boardToggleAria: "Display mode toggle",
    boardBtnRenamed: "Renamed",
    boardBtnDatamined: "Datamined",
    tableACaption: "Table A — Datamined Triples → Verified Multype Columns",
    tableAColModule: "Module Context",
    tableAColAttr: "Attribute (Sub-table)",
    tableAColBuff: "Source Buff File",
    tableAColName: "Verified Rename",
    tableARow1Note: "SSR Relic passive final damage buff",
    tableARow2Note: "4-piece matrix final damage set effect",
    tableARow3Note: "Simulacrum trait passive damage multiplier",
    tableARow4Note: "Equipped weapon passive flame damage bonus",
    tableARow5Note: "Uncategorized relic damage multiplier",
    exceptionRelicTableLabel:
      "Confirmed Normal Exception Relics in NoModule::FinalDamageExtraUpMult:",
    exceptionRelic1Name: "Buff dealer",
    exceptionRelic2Name: "Type Count",
    exceptionRelic3Name: "Omnium shield",
    exceptionRelic4Name: "Quantum cloak",
    exceptionRelic5Name: "Drone",
    tableBCaption: "Table B — Four Authoritative Worked Examples",
    tableBColName: "Readable Name",
    tableBColCat: "Category (Main → Sub)",
    tableBColKey: "Datamined Key",
    tableBColRule: "Mechanics Rule Illustrated",
    tableBRow1Rule:
      "Enemy debuff table: Multiplies onto character-side buffs because it sits in the target vulnerability table.",
    tableBRow2Rule:
      "Debuff table placement: Despite being a relic, its damage taken modifier is classified under the enemy debuff table.",
    tableBRow3Rule:
      "Dual-table multiplier: The same buff file exists in two distinct tables simultaneously, multiplying together: (1 + 0.10) × (1 + 0.10) = 1.21×.",
    tableBRow4Rule:
      "Target vulnerability debuff: Relic field applies damage vulnerability directly to targets inside the rift.",
    tableBDualBadge: "Dual-Table Placement",
    tableBEnemyBadge: "Enemy Debuff",
    tableBDebuffBadge: "Debuff Table",
    tableBRelicBadge: "Relic Debuff",
    tocDisclaimer: "Disclaimer",
    secDisclaimerTitle: "Disclaimer: Game Truth vs. Developer Inconsistencies",
    disclaimerIntro:
      "The Multype tables 100% accurately reflect the real running game engine and active memory structures. However, in-game skill descriptions and translations do not always reflect the truth. Game developers occasionally introduce human errors, typos, or odd architectural quirks, causing an intuitively assumed category to land in a completely unexpected bucket under the hood.",
    disclaimerLanCardTitle: "Example 1: Lan Trait placed inside the Matrix category",
    disclaimerLanDesc: (
      <>
        {
          "Instead of placing Lan's simulacrum trait into character traits, the developers placed it directly into the Matrix module ("
        }
        <code>{"ModuleExtraType_Suit"}</code>
        {
          "). As a result, Lan Trait mathematically stacks and synergizes as if it were a matrix set, sharing a bucket with Asurada 4pc and Nemesis 4pc rather than other traits:"
        }
      </>
    ),
    disclaimerLanCategoryName: "Matrix",
    disclaimerLanCategoryMeta: "8 SUB COLUMNS",
    disclaimerLanColName: "FinalDamageExtraUpMult",
    disclaimerLanColMeta: "8 FILES",
    disclaimerBeCardTitle:
      "Example 2: Arbitrary 'Be' prefix in WeaponPassive (ThunderAtkBeExtraUpMult)",
    disclaimerBeDesc: (
      <>
        {"In "}
        <code>{"ModuleExtraType_WeaponPassive"}</code>
        {", there was already an established sub-table "}
        <code>{"ThunderAtkExtraUpMult"}</code>
        {" (31 files). However, developers arbitrarily added a 'Be' prefix — "}
        <code>{"ThunderAtkBeExtraUpMult"}</code>
        {
          " (2 files) — and shoved new buffs there without any apparent logical rationale, creating an unintentional separate multiplier:"
        }
      </>
    ),
    disclaimerBeCategoryName: "ModuleExtraType_WeaponPassive",
    disclaimerBeCol1Name: "ThunderAtkBeExtraUpMult",
    disclaimerBeCol1Meta: "2 FILES",
    disclaimerBeCol2Name: "ThunderAtkExtraUpMult",
    disclaimerBeCol2Meta: "31 FILES",
    disclaimerConclusion:
      "These are merely the most striking examples of game descriptions diverging from actual engine code. Multype reveals the raw reality of the engine — letting you build around how buffs genuinely calculate in combat rather than how tooltips describe them.",
  },
  ru: {
    metaTitle: "Руководство по Multype — Стаки баффов и множители | TOF Datamine",
    metaDesc:
      "Руководство для игроков по стакам баффов, категориям множителей и ModuleExtraType в инструменте Multype.",
    heroEyebrow: "РУКОВОДСТВО ПО MULTYPE",
    heroTitle: "Стаки баффов и множители",
    heroSubtitle:
      "Справочное руководство для игроков: как складываются эффекты баффов, какие категории перемножаются и как читать таблицы данных Multype.",
    backToTool: "Назад к странице Multype",
    tocTitle: "НА ЭТОЙ СТРАНИЦЕ",
    tocGroupBasics: "РУКОВОДСТВО",
    tocOverview: "Обзор",
    tocRenaming: "Как устроены названия",
    tocTables: "Как читать правильно",
    tocSimplified: "Упрощённое чтение",
    permalinkLabel: "Постоянная ссылка",
    secRenamingTitle: "Как устроены названия",
    renamingP1:
      "Эти читаемые названия не набраны вручную из гайдов. Игра была отсканирована целиком; каждая найденная в ассетах структура модификатора становится сырой строкой в наборе данных.",
    renamingP2: (
      <>
        {"Сырая строка состоит из трёх частей: модульный контекст ("}
        <code>{"ModuleExtraType_*"}</code>
        {"), атрибут / под-таблица (напр. "}
        <code>{"FinalDamageExtraUpMult"}</code>
        {") и исходный файл баффа. Эта сырая тройка — режим "}
        <strong>{"«Datamined»"}</strong>
        {"."}
      </>
    ),
    renamingP3: (
      <>
        {
          "Затем через внутриигровую консоль каждый бафф вытаскивается вживую, его реальный эффект сверяется, и к нему привязывается понятное название. Это режим "
        }
        <strong>{"«Renamed»"}</strong>
        {" / "}
        <strong>{"«Combined»"}</strong>
        {"."}
      </>
    ),
    renamingExampleBeforeLabel: "Сырая тройка (режим «Datamined»):",
    renamingExampleAfterLabel: "Проверенное название (режим «Renamed»):",
    secTablesTitle: "Как читать правильно: разные таблицы = разные баффы",
    tablesP1: (
      <>
        {"Каждая таблица (модуль × атрибут) — это отдельная «корзина» множителя. Значения "}
        <strong>{"внутри"}</strong>
        {" одной таблицы складываются; "}
        <strong>{"разные"}</strong>
        {" таблицы "}
        <strong>{"перемножаются"}</strong>
        {"."}
      </>
    ),
    tablesP2: (
      <>
        {"Ключевой момент: две таблицы могут иметь "}
        <strong>{"одинаковое"}</strong>
        {" отображаемое имя («Final Dmg») и при этом быть "}
        <strong>{"разными"}</strong>
        {" категориями, потому что относятся к разным модулям. В игре они "}
        <strong>{"перемножаются"}</strong>
        {
          ", хотя подпись выглядит одинаково. То же самое с элементальными таблицами (Ice / Fire / Volt / Phys)."
        }
      </>
    ),
    tablesExampleBadge: "РЕАЛЬНЫЙ ПРИМЕР",
    tablesExampleTitle: "Ene A6 10% в двух разных таблицах",
    tablesExampleDesc:
      "Один и тот же файл баффа появляется одновременно в двух разных таблицах. Так как это две отдельные корзины множителей, оба бонуса действуют и перемножаются:",
    tablesExampleTable1Label: "Таблица 1 (Ледяной дебафф)",
    tablesExampleTable1Desc: "Дебафф уязвимости к ледяному урону (+10%)",
    tablesExampleTable2Label: "Таблица 2 (Final Dmg дебафф)",
    tablesExampleTable2Desc: "Дебафф уязвимости к финальному урону (+10%)",
    tablesMultipliedLabel: "Перемножаются",
    tablesExampleFormula:
      "В игре: (1 + 0.10) × (1 + 0.10) = 1.21× (Перемножение, а не сложение 1.20×)",
    tablesBridgeText:
      "Если выискивать каждый бафф по категориям и таблицам без консоли разработчика слишком сложно, используйте упрощённый шаблон ниже — он покроет 99% всех вопросов по стакам и множителям (если только сами разработчики где-то не ошиблись).",
    tablesBridgeLink: "Перейти к упрощённому чтению",
    secSimplifiedTitle: "Упрощённое чтение",
    simplifiedIntro: (
      <>
        {
          "Почти всё, что вам важно, — это Final Dmg и Elemental Dmg вашего элемента. Они делятся на несколько "
        }
        <strong>{"основных групп"}</strong>
        {":"}
      </>
    ),
    groupWeaponActiveTitle: "Активные баффы оружий",
    groupWeaponActiveLabel: "Оружие (актив)",
    groupWeaponActiveDesc: "Баффы, активируемые нажатием навыка или конкретным действием.",
    groupWeaponPassiveTitle: "Пассивные баффы оружий",
    groupWeaponPassiveLabel: "Оружие (пассив)",
    groupWeaponPassiveDesc: "Баффы, действующие просто за наличие оружия в вашей сборке.",
    groupMatrixTitle: "Матрицы",
    groupMatrixLabel: "Матрицы",
    groupMatrixDesc: "Свойства и бонусы сетов матриц, не зависящие от выбора оружия.",
    groupTraitsTitle: "Трейты",
    groupTraitsLabel: "Трейты",
    groupTraitsDesc: "Черты симулякров (комбинация ДД + саппорт), которые считаются отдельно.",
    groupRelicsTitle: "Релики",
    groupRelicsLabel: "Реликвии",
    groupRelicsDesc: "Бонусы реликвий, разделённые на Final Dmg и Elemental Dmg.",
    groupDebuffsTitle: "Всё остальное",
    groupDebuffsLabel: "Дебаффы / контент",
    groupDebuffsDesc: "Все внешние боевые модификаторы, дебаффы целей и условия контента.",
    simplifiedRuleNoCrossTitle: "Группы не пересекаются",
    simplifiedRuleNoCrossText: (
      <>
        {"Группы "}
        <strong>{"не пересекаются"}</strong>
        {". Чтобы сравнивать матрицы, "}
        <strong>{"не нужно"}</strong>
        {
          " думать, какие у вас оружия: матрицы синергируют между собой по простому правилу Final Dmg + Elemental Dmg и никак не пересекаются с оружиями. "
        }
        <mark className={"guide-template-highlight"}>
          {"Сравнивайте матрицы только с матрицами"}
        </mark>
        {" — и это будет абсолютно правильно."}
      </>
    ),
    templateRuleBadge: "Шаблонное правило",
    templateRuleMatricesOnly: "Сравнивайте матрицы только с матрицами",
    simplifiedRuleWeaponsTitle: "Оружия: активные и пассивные",
    simplifiedRuleWeaponsText: "С оружиями чуть сложнее — надо прочитать текст баффа:",
    simplifiedRuleWeaponsActive: (
      <>
        {"Если бафф выдаётся при нажатии скила / за какое-то действие — это "}
        <strong>{"АКТИВ"}</strong>
        {" (сравнивать с активами)."}
      </>
    ),
    simplifiedRuleWeaponsPassive: (
      <>
        {"Если бафф выдаётся просто за наличие оружия в билде — это "}
        <strong>{"ПАССИВ"}</strong>
        {"."}
      </>
    ),
    simplifiedRuleTraitsTitle: "Расчёт трейтов",
    simplifiedRuleTraitsText: "Трейты (комбинация ДД + саппорт) считаются отдельно.",
    simplifiedRuleRelicsTitle: "Независимость реликов",
    simplifiedRuleRelicsText: (
      <>
        {"Релики: Final и Elemental считаются отдельно, и релики "}
        <strong>{"не сочетаются"}</strong>
        {" с трейтами или матрицами."}
      </>
    ),
    simplifiedExceptionTitle: "ВАЖНОЕ ИСКЛЮЧЕНИЕ — таблица «No cathegory / Normal»",
    simplifiedExceptionText: (
      <>
        {"Эти конкретные релики "}
        <strong>{"не подчиняются"}</strong>
        {" правилам групп выше. Релики из таблицы "}
        <code>{"NoModule::FinalDamageExtraUpMult"}</code>
        {
          " (такие как Колант, Щит Омниума, Квантовый плащ, Дрон) — это просто отдельная категория, которая перемножается со всем остальным. (Понятное исключение.)"
        }
      </>
    ),
    simplifiedCrossMultiTitle: "Как Final и Elemental Dmg перемножаются между категориями",
    simplifiedCrossMultiText: (
      <>
        <p>
          {
            "В итоге весь результирующий урон билда представляет собой произведение двух главных множителей: "
          }
          <strong>{"Final Dmg × Elemental Dmg"}</strong>
          {"."}
        </p>
        <p>
          {
            "Каждый из них, в свою очередь, перемножается между независимыми категориями (корзинами): "
          }
          <strong>{"Final Dmg"}</strong>
          {" из матриц умножается на "}
          <strong>{"Final Dmg"}</strong>
          {" из активного баффа оружия, на "}
          <strong>{"Final Dmg"}</strong>
          {" из пассивного баффа оружия, на трейты и на релики. Точно так же "}
          <strong>{"Elemental Dmg"}</strong>
          {" перемножается между матрицами, активом оружия, пассивом оружия, трейтами и реликами."}
        </p>
      </>
    ),
    simplifiedElementalAlertTitle: "В игре НЕ существует двух типов элементального урона!",
    simplifiedElementalAlertP1: (
      <>
        <strong>{"Frost Dmg и Elemental Dmg — это одно и то же"}</strong>
        {
          " (как и Flame, Volt, Physical). В игре не существует отдельного самостоятельного множителя «общего элементального урона», который бы перемножался с уроном конкретной стихии."
        }
      </>
    ),
    simplifiedElementalAlertP2: (
      <>
        {"Если один источник даёт "}
        <em>{"«Frost Dmg +X%»"}</em>
        {", а другой "}
        <em>{"«Elemental Dmg +Y%»"}</em>
        {
          ", они не создают две разные перемножающиеся ступени для ледяного оружия — они оба относятся к одной и той же корзине элементального урона соответствующей категории."
        }
      </>
    ),
    simplifiedExamplesTitle: "Справочно: четыре разобранных примера",
    simplifiedExamplesIntro: "Эти правила наглядно прослеживаются на четырёх проверенных примерах:",
    example1Name: "Shiro A1 against enemy",
    example1Code: "Buff_DartsPhy_SSR_Level1_BeDamageUp.json",
    example2Name: "Thalassic heart",
    example2Code: "Buff_FinBeDMGReduceLvl2_Artifact_SSR_018.json",
    example3Name: "Ene A6 10%",
    example3Code: "Buff_HammerIce_SR_DamageUp_all10_ice2_OS.json",
    example4Name: "Spacetime rift",
    example4Code: "GE_ArtifactSSR005_BeAtkUp.json",
    showcaseBadge: "Интерфейс Multype",
    subMetaFiles: "ФАЙЛОВ",
    subMetaCol: "КОЛОНКА",
    exampleSelectorAria: "Выбор примера",
    exampleSelectorLabel: "Реальный проверяемый пример",
    comparisonDataminedBadge: "Режим Datamined (Сырые файлы)",
    comparisonArrowText: "Сверка в консоли игры и привязка имени",
    comparisonRenamedBadge: "Режим Renamed (Понятные названия)",
    boardCategoryMeta: "5 групп категорий · прокрутка вправо →",
    boardToggleAria: "Переключение режима отображения",
    boardBtnRenamed: "С ренеймом",
    boardBtnDatamined: "Сырые файлы",
    tableACaption: "Таблица А — Исходные тройки Datamined → Проверенные колонки Multype",
    tableAColModule: "Модульный контекст",
    tableAColAttr: "Атрибут (под-таблица)",
    tableAColBuff: "Исходный файл баффа",
    tableAColName: "Проверенное название",
    tableARow1Note: "Пассивный финальный урон SSR реликвии",
    tableARow2Note: "Эффект сета из 4 матриц на финальный урон",
    tableARow3Note: "Пассивный множитель урона трейта симулякра",
    tableARow4Note: "Пассивный бонус пламенного урона экипированного оружия",
    tableARow5Note: "Множитель урона реликвии без категории",
    exceptionRelicTableLabel:
      "Проверенные реликвии-исключения из NoModule::FinalDamageExtraUpMult:",
    exceptionRelic1Name: "Buff dealer",
    exceptionRelic2Name: "Type Count",
    exceptionRelic3Name: "Omnium shield",
    exceptionRelic4Name: "Quantum cloak",
    exceptionRelic5Name: "Drone",
    tableBCaption: "Таблица Б — Четыре проверенных практических примера",
    tableBColName: "Понятное название",
    tableBColCat: "Категория (модуль → таблица)",
    tableBColKey: "Ключ в датамайне",
    tableBColRule: "Иллюстрируемое правило",
    tableBRow1Rule:
      "Таблица дебаффов цели: перемножается с баффами персонажа, так как находится в таблице уязвимости врага.",
    tableBRow2Rule:
      "Позиция в дебаффах: несмотря на происхождение от релика, модификатор урона по цели классифицирован в таблице дебаффов.",
    tableBRow3Rule:
      "Перемножение двух таблиц: один и тот же файл баффа находится в двух разных таблицах одновременно и перемножается: (1 + 0.10) × (1 + 0.10) = 1.21×.",
    tableBRow4Rule:
      "Дебафф уязвимости цели: поле реликвии накладывает уязвимость к урону прямо на цели в зоне действия.",
    tableBDualBadge: "Две разные таблицы",
    tableBEnemyBadge: "Дебафф на враге",
    tableBDebuffBadge: "Таблица дебаффов",
    tableBRelicBadge: "Дебафф реликвии",
    tocDisclaimer: "Дисклеймер",
    secDisclaimerTitle: "Дисклеймер: правда движка и ошибки разработчиков",
    disclaimerIntro:
      "Таблицы Multype на 100% соответствуют реальному игровому клиенту и активным структурам в памяти. Однако игровой текст и описания далеко не всегда соответствуют правде. Разработчики игры тоже люди: они допускают человеческие ошибки, опечатки и странные архитектурные решения, из-за чего интуитивно предполагаемая категория оказывается совсем не той, о которой думает игрок.",
    disclaimerLanCardTitle: "Пример 1: Черта Lan (Lan Trait) в категории матриц",
    disclaimerLanDesc: (
      <>
        {
          "Вместо категории черт симулякров (Traits) разработчики поместили черту Lan напрямую в модуль матриц ("
        }
        <code>{"ModuleExtraType_Suit"}</code>
        {
          "). В результате бафф от черты Lan математически складывается и синергирует как часть сета матриц, находясь в одной корзине с Asurada 4pc и новой Nemesis 4pc, а не с другими трейтами:"
        }
      </>
    ),
    disclaimerLanCategoryName: "Matrix",
    disclaimerLanCategoryMeta: "8 СУБ-КОЛОНОК",
    disclaimerLanColName: "FinalDamageExtraUpMult",
    disclaimerLanColMeta: "8 ФАЙЛОВ",
    disclaimerBeCardTitle: "Пример 2: Приписка «Be» в WeaponPassive (ThunderAtkBeExtraUpMult)",
    disclaimerBeDesc: (
      <>
        {"В модуле пассивок оружия ("}
        <code>{"ModuleExtraType_WeaponPassive"}</code>
        {") исторически существовала базовая подтаблица "}
        <code>{"ThunderAtkExtraUpMult"}</code>
        {" (31 файл). Однако разработчики зачем-то создали новую подтаблицу с припиской «Be» — "}
        <code>{"ThunderAtkBeExtraUpMult"}</code>
        {
          " (2 файла) — и добавили туда новые баффы без понятной на то причины, породив отдельный множитель:"
        }
      </>
    ),
    disclaimerBeCategoryName: "ModuleExtraType_WeaponPassive",
    disclaimerBeCol1Name: "ThunderAtkBeExtraUpMult",
    disclaimerBeCol1Meta: "2 ФАЙЛА",
    disclaimerBeCol2Name: "ThunderAtkExtraUpMult",
    disclaimerBeCol2Meta: "31 ФАЙЛ",
    disclaimerConclusion:
      "И это лишь самые яркие примеры нестыковок между игровыми описаниями и кодом. Multype вскрывает именно реальную механику движка Tower of Fantasy — чтобы вы строили билды на основе того, как баффы работают на самом деле, а не того, как они описаны во внутриигровом тексте.",
  },
} satisfies Record<"en" | "ru", Record<string, ReactNode>>);
export const GUIDE_COPY = createLocaleCopies({ ...GUIDE_SOURCE, ...guideLocaleCopies(GUIDE_SOURCE.en) });
export type GuideCopy = typeof GUIDE_SOURCE.en;
