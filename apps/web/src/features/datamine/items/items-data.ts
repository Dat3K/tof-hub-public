// Authoritative Baseline Items Dataset
import type { DatamineItemsDataset } from '@tof-hub/contracts';
import type { ItemsMode, ItemRow } from './items-types';
import { normalizeItemRows } from './items-domain';

export const BASELINE_GACHA_ITEMS: Record<string, any> = {
  "1": {
    "id": "stave_thunder_plasm",
    "name": "Holy Scepter Data Core",
    "original": "圣痕权杖数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "2": {
    "id": "cannon_ice_plasm",
    "name": "Terminator Data Core",
    "original": "终结者数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "3": {
    "id": "hammer_ice_plasm",
    "name": "Initial heavy impact data core",
    "original": "初动重击数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "4": {
    "id": "bow_physic_plasm",
    "name": "The Nightbird's Feathers",
    "original": "夜雀之羽数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "5": {
    "id": "spear_thunder_plasm",
    "name": "Thunderbolt data core.",
    "original": "雷霆战戟数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "6": {
    "id": "digger_thunder_plasm",
    "name": "Thunder double-edged data core",
    "original": "疾雷双刃数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "7": {
    "id": "bigsword_ice_plasm",
    "name": "The Nut of the Vertigo Data.",
    "original": "蔷薇之锋数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "8": {
    "id": "bow_ice_plasm",
    "name": "Ice Wind Target Data Core",
    "original": "冰风之矢数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "9": {
    "id": "stave_ice_plasm",
    "name": "Zero Pointer Data Core",
    "original": "零度指针数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "10": {
    "id": "sickle_fire_plasm",
    "name": "Black Crows Stencillator Data Core",
    "original": "黑鸦冥镰数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "11": {
    "id": "gun_fire_plasm",
    "name": "Flaming revolver data core",
    "original": "炽焰左轮数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "12": {
    "id": "sword_physic_plasm",
    "name": "Red Lotus blade data core",
    "original": "红莲刃数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "13": {
    "id": "darts_physic_plasm",
    "name": "The ringed blade data core",
    "original": "环海轮刃数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "14": {
    "id": "cube_fire_plasm",
    "name": "Reject Cube Data Core",
    "original": "否决立方数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "15": {
    "id": "dgun_thunder_plasm",
    "name": "Super-electromagnetic Double Star Data Core",
    "original": "超电磁双星数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "16": {
    "id": "ShieldAxe_fire_plasm",
    "name": "V2 Melting Shield Data Core",
    "original": "V2熔驱盾数据核心",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp",
    "description_en": "Fusion cores converted from duplicate weapons.",
    "description_ru": "Ядра синтеза конвертированы из дублирующегося оружия."
  },
  "17": {
    "id": "Item_gift_1001",
    "name": "A bunch of flowers.",
    "original": "一束鲜花",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift01.webp",
    "description_en": "A nicely presented batch of flowers and a prime gift choice, though watch out for those who are allergic to pollen or dislike plants. The flowers are produced in Aesperia, and Simulacra from other regions may not be interested in them.",
    "description_ru": "Прекрасно подобранные цветы — это отличный выбор для подарка (но только не тем, у кого аллергия на пыльцу или кто не любит растения). Эти цветы вырастили в Асперии, и симулякры из других регионов могут не заинтересоваться ими."
  },
  "18": {
    "id": "Item_gift_1002",
    "name": "Workout dumb bell",
    "original": "健身哑铃",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift02.webp",
    "description_en": "An instrument for weight training and mostly used for fitness—except in certain drastic situations... Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Спортивный инвентарь, который в основном используется для силовых тренировок — за исключением некоторых экстремальных ситуаций... Производится в Асперии, и симулякры из других регионов могут не заинтересоваться им."
  },
  "19": {
    "id": "Item_gift_1003",
    "name": "A nice picture frame.",
    "original": "精美相框",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift03.webp",
    "description_en": "Specifically made for safekeeping precious photos, thus built from special materials and difficult to take apart. Produced in Aesperia, and Simulacra from other regions may not be interested in them.",
    "description_ru": "Такие рамки специально созданы для хранения самых ценных фотографий, так что их делают из особых материалов и их трудно разобрать. Производятся в Асперии, и симулякры из других регионов могут не заинтересоваться ими."
  },
  "20": {
    "id": "Item_gift_1004",
    "name": "A letter card from Ida Star.",
    "original": "艾达星明信片",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift04.webp",
    "description_en": "Shows different landscapes on Aida. Despite Omnium radiation pollution and other adverse conditions, there is still scenery worth preserving. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Показывает различные пейзажи Аиды. Несмотря на загрязнение от излучения омния и другие неблагоприятные условия, здесь еще есть пейзажи, достойные запечатления. Произведена в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "21": {
    "id": "Item_gift_1005",
    "name": "A wool scarf.",
    "original": "羊绒围巾",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift05.webp",
    "description_en": "It's supposed to be made of processed wool, but since that is now obsolete, the \"wool\" is actually a composite material. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Предполагается, что такие шарфы вяжут из обработанной шерсти, но этого материала уже не осталось, так что эта «шерсть» на самом деле является композитным материалом. Производится в Асперии, и симулякры из других регионов могут не заинтересоваться им."
  },
  "22": {
    "id": "Item_gift_1006",
    "name": "Special poker cards.",
    "original": "特制扑克牌",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift41.webp",
    "description_en": "No one knows who created this deck, but judging from the rules of play, the maker must have been a very interesting fellow. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Неизвестно, кто создал эту колоду, но, судя по правилам игры, создатель был весьма интересным человеком. Произведена в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "23": {
    "id": "Item_gift_1007",
    "name": "Mini-pots.",
    "original": "迷你盆栽",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift06.webp",
    "description_en": "Miniature potted plant. Please note that the plant is artificial and needs no conventional care. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Миниатюрное комнатное растение. Обратите внимание, что растение искусственное и не нуждается в уходе. Произведено в Асперии, и симулякры из других регионов могут не заинтересоваться им."
  },
  "24": {
    "id": "Item_gift_1008",
    "name": "Ancient harmonica",
    "original": "复古口琴",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift07.webp",
    "description_en": "For playing lovely melodies. It's hard to come by, so only a few people on Aida can actually play one. Nowadays, that's probably limited to the true music aficionados. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Инструмент для воспроизведения прекрасных мелодий. Такие трудно достать, поэтому всего несколько человек на Аиде умеют на них играть. В наши дни, пожалуй, это удел истинных ценителей музыки. Производится в Асперии, и симулякры из других регионов могут не заинтересоваться им."
  },
  "25": {
    "id": "Item_gift_1009",
    "name": "Paper windmill",
    "original": "纸风车",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift08.webp",
    "description_en": "A plain toy that couldn't be more ordinary, but nonetheless has never failed to bring comfort and joy. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Простая и незатейливая игрушка, которая, тем не менее, продолжает приносить людям радость. Произведена в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "26": {
    "id": "Item_gift_1010",
    "name": "Snack box.",
    "original": "零食盒子",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift09.webp",
    "description_en": "Snack box created by Fennie on Astra, containing various irresistible munchies. A very popular gift across all sectors. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Коробка с закусками, которую собрала Фенни на Астре. В ней содержатся различные неотразимые лакомства, и это очень популярный подарок во всех секторах. Производится в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "27": {
    "id": "Item_gift_2001",
    "name": "Practical Tool Group",
    "original": "实用工具组",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift10.webp",
    "description_en": "Designed for practical purposes and is ready to use. May also be applied as spare parts. Receives a big thumbs-up from technicians for its versatility. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Предназначен для практических целей и готов к использованию. Также может служить в качестве запасных частей. Техники высоко ценят его за универсальность. Производится в Асперии, и симулякры из других регионов могут не заинтересоваться им."
  },
  "28": {
    "id": "Item_gift_2002",
    "name": "Chess",
    "original": "西洋棋",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift11.webp",
    "description_en": "A game for two players, though some people actually prefer playing by themselves. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Игра для двух игроков, хотя некоторые предпочитают играть в одиночку. Набор произведен в Асперии, и симулякры из других регионов могут не заинтересоваться им."
  },
  "29": {
    "id": "Item_gift_2003",
    "name": "Furry toys.",
    "original": "毛绒玩具",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift12.webp",
    "description_en": "Kids' favorite plush toy. Adorable with a scent reminiscent of a warm day under the sun. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Любимая плюшевая игрушка у детей. Очаровательный облик и аромат, напоминающий про теплый солнечный день. Производится в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "30": {
    "id": "Item_gift_2004",
    "name": "Custom suit",
    "original": "定制西装",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift13.webp",
    "description_en": "Custom-made suit, finer and suaver than the common variety, with accessories to boot. Those with dramatic flair should like it. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Сшитый на заказ костюм, более элегантный и мягкий, чем обычный, и с аксессуарами в придачу. Он понравится тем, кто любит элемент драмы. Произведен в Асперии, и симулякры из других регионов могут не заинтересоваться им."
  },
  "31": {
    "id": "Item_gift_2005",
    "name": "Vitamin supplement.",
    "original": "维他命补充包",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift14.webp",
    "description_en": "Wellness supplement. A necessity for those working too long or too indulged in playing games to have proper meals. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Оздоровительная добавка. Необходима тем, кто слишком долго работает или слишком увлечен играми, чтобы нормально питаться. Произведена в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "32": {
    "id": "Item_gift_2006",
    "name": "The gem necklace.",
    "original": "宝石项链",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift15.webp",
    "description_en": "How much is this gem necklace worth? Forget all the speculations and just keep this valuable safe! Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Сколько стоит это ожерелье с самоцветом? Забудьте все расчеты и просто берегите его как зеницу ока! Произведено в Асперии, и симулякры из других регионов могут не заинтересоваться им."
  },
  "33": {
    "id": "Item_gift_2007",
    "name": "Cat pillows.",
    "original": "猫型抱枕",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift16.webp",
    "description_en": "A throw pillow in the shape of a cat. Very relaxing and therapeutic to hold. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Подушка в форме кошки. Очень расслабляет и оказывает целебное воздействие. Произведена в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "34": {
    "id": "Item_gift_2008",
    "name": "Fill Color Book",
    "original": "填色画册",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift17.webp",
    "description_en": "The seller said once all the pages have been colored in, you can trade it in for a brand new one. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Продавец сказал, что когда все страницы будут раскрашены, вы сможете обменять книжку на новую. Произведена в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "35": {
    "id": "Item_gift_2009",
    "name": "The meteor in the bottle.",
    "original": "瓶中陨石",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift18.webp",
    "description_en": "Meteorite in a clear bottle. The meteorite seems to be a space rock that's not burned out and some sort of mineral mixture giving off a faint glow. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Метеорит в прозрачной бутылке. Метеорит, похоже, представляет собой не до конца сгоревший камень из космоса и некую минеральную смесь, от которой исходит слабое свечение. Произведен в Асперии, и симулякры из других регионов могут не заинтересоваться им."
  },
  "36": {
    "id": "Item_gift_2010",
    "name": "A perfume bottle.",
    "original": "香水瓶",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift19.webp",
    "description_en": "Lovely, elegant glass vial with pleasantly scented liquid inside. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Милый и очень элегантный стеклянный флакон с приятно пахнущей жидкостью внутри. Производится в Асперии, и симулякры из других регионов могут не заинтересоваться им."
  },
  "37": {
    "id": "Item_gift_2011",
    "name": "Set up the Tatalos.",
    "original": "塔塔洛斯摆件",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift20.webp",
    "description_en": "A miniature figure allegedly takes after the form of Tartarus. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Миниатюрная фигурка, предположительно изображающая Тартара. Произведена в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "38": {
    "id": "Item_gift_2012",
    "name": "New edition card settings",
    "original": "新版卡卡摆件",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift21.webp",
    "description_en": "Receiving a flood of complaints protesting the discontinued production of the old Kalka figure, the makers decided to offer a new version. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Получив поток жалоб на прекращение выпуска старой фигурки Калки, создатели решили предложить покупателям новую версию. Производится в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "39": {
    "id": "Item_gift_2013",
    "name": "Crazy Dimon.",
    "original": "疯狂迪蒙手办",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift22.webp",
    "description_en": "Nobody knows when the fad for the Mad Dumont figurine began, except everyone wants one all of a sudden. Produced in Aesperia, Simulacra from other regions may not be interested in it.",
    "description_ru": "Никто не знает, когда началось увлечение фигуркой Безумного Дюмона, но она вдруг понадобилась буквально каждому. Произведена в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "40": {
    "id": "Item_gift_2014",
    "name": "Moon rabbits, toy.",
    "original": "月兔拼装玩具",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift23.webp",
    "description_en": "Assembly required. Based on the image of moonrabbit. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Требуется сборка. Основан на образе лунного зайца. Произведен в Асперии, и симулякры из других регионов могут не заинтересоваться им."
  },
  "41": {
    "id": "Item_gift_2015",
    "name": "Ling Ji did it.",
    "original": "灵姬手办",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift24.webp",
    "description_en": "Miniature figurine based on Spirit Princess, the smart servant. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Миниатюрная фигурка, основанная на образе Принцессы-Духа, умной прислуги. Произведена в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "42": {
    "id": "Item_gift_3001",
    "name": "New Game",
    "original": "新型游戏机",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift25.webp",
    "description_en": "New high-end game console, designed by a computer genius. The high production cost has caused its shortage. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Новая сверхсовременная игровая консоль, разработанная компьютерным гением. Высокая стоимость производства стала причиной того, что таких консолей очень мало. Производится в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "43": {
    "id": "Item_gift_3002",
    "name": "Snowflake crystal ball",
    "original": "雪花水晶球",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift26.webp",
    "description_en": "Originated in the Warren Snowfield, it reflects pure driven snow during winter. It's now been remade into a household decoration. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Этот снежный шар из Снежного поля Уоррена показывает чистый и нетронутый зимний снег. Служит домашним украшением. Производится в Асперии, и симулякры из других регионов могут не заинтересоваться им."
  },
  "44": {
    "id": "Item_gift_3003",
    "name": "Mechanical eight-song box",
    "original": "机械八音盒",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift27.webp",
    "description_en": "A metal music box. Not sure if its previous owner broke it or what, but the pleasant tune has been shut off somehow. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Металлическая музыкальная шкатулка. Возможно, предыдущий владелец ее каким-то образом сломал, потому что приятная мелодия больше не звучит. Произведена в Асперии, и симулякры из других регионов могут могут не заинтересоваться ей."
  },
  "45": {
    "id": "Item_gift_3004",
    "name": "Silver cookers.",
    "original": "银质厨具",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift28.webp",
    "description_en": "An expensive-looking complete set of cookware. Supposedly it was owned by a neurotic chef who never let anyone touch these precious tools. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Дорого выглядящий полный набор посуды. Предположительно, он принадлежал очень нервному повару, который никому не позволял прикасаться к своим драгоценностям. Произведен в Асперии, и симулякры из других регионов могут не заинтересоваться им."
  },
  "46": {
    "id": "Item_gift_3005",
    "name": "The Ida Star Caricature.",
    "original": "《艾达星漫画》",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift29.webp",
    "description_en": "Depicts the adventures of Tata on Aida in monthly issues. The limited quantity and popularity have led to fights over the comic book every release. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Ежемесячные выпуски комикса рассказывают о приключениях Таты на Аиде. Ограниченное количество и популярность привели к тому, что за каждый новый выпуск вспыхивают драки. Производится в Асперии, и симулякры из других регионов могут не заинтересоваться им."
  },
  "47": {
    "id": "Item_gift_3006",
    "name": "Benjistre.",
    "original": "班吉斯特产",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift30.webp",
    "description_en": "Contains various specialties from Banges, each box a random selection to represent local diversity. Of course, that means you never know exactly what you're going to get. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Содержит различные деликатесы из Бэнджи. В каждой коробке — случайный набор, подчеркивающий местное разнообразие. Конечно, это означает, что вы никогда точно не знаете, что получите. Производится в Асперии, и симулякры из других регионов могут могут не заинтересоваться им."
  },
  "48": {
    "id": "Item_gift_3007",
    "name": "Helgader 3D puzzle",
    "original": "海嘉德3D拼图",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift31.webp",
    "description_en": "A puzzle that's sweeping Hykros. The novel appearance and mode are nothing but fun. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Головоломка, захватившая весь Гикрос. Новый внешний вид и игровой процесс удваивают удовольствие. Произведена в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "49": {
    "id": "Item_gift_3008",
    "name": "Volan fossils.",
    "original": "沃兰化石",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift32.webp",
    "description_en": "Ancient remains sealed in ice, discovered in Warren Snowfield. Very rare and highly collectible. Produced in Aesperia, and Simulacra from other regions may not be interested in them.",
    "description_ru": "Древние замороженные во льду останки, обнаруженные на Снежном поле Уоррена. Очень редкий коллекционный предмет. Найдены в Асперии, и симулякры из других регионов могут не заинтересоваться ими."
  },
  "50": {
    "id": "Item_gift_3009",
    "name": "Croen Monument.",
    "original": "克罗恩纪念币",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift33.webp",
    "description_en": "Limited commemorative coins minted by Crown with a portrait of the mines' owner on the front and a stylized \"K\" on the back. Collect seven of these babies and get a day off with pay—maybe. Produced in Aesperia, and Simulacra from other regions may not be interested in them.",
    "description_ru": "Монеты ограниченной памятной серии, отчеканенные в Крауне. С аверса у них портрет владельца шахт, а с реверса — стилизованная буква «К». Соберите семь таких малышей и получите оплаченный выходной... может быть. Выпускаются в Асперии, и симулякры из других регионов могут не заинтересоваться ими."
  },
  "51": {
    "id": "Item_gift_3010",
    "name": "The tower is a limited number.",
    "original": "限量塔塔手办",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift34.webp",
    "description_en": "Limited collectible figurine, an Aida comic memorabilia. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Коллекционная фигурка ограниченной серии — сувенир по комиксам Аиды. Произведена в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "52": {
    "id": "Item_gift_3011",
    "name": "Alfred Metal Handy",
    "original": "阿福金属手办",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift35.webp",
    "description_en": "To fully resemble the original Alf, the makers made this one out of metal. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Чтобы фигурка полностью походила на оригинального Альфа, создатели сделали ее из металла. Производится в Асперии, и Симулякры из других регионов могут не заинтересоваться ей."
  },
  "53": {
    "id": "Item_gift_3012",
    "name": "Smart doll.",
    "original": "斯玛特玩偶",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift36.webp",
    "description_en": "A toy based on the image of Smarty. The makers replaced the artificial plant on its head with a live plant, making it highly collectible. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Игрушка, основанная на образе Смарти. Создатели заменили искусственное растение у него на голове на живое, так что это ценный коллекционный экземпляр. Производится в Асперии, и симулякры из других регионов могут не заинтересоваться им."
  },
  "54": {
    "id": "Item_gift_3013",
    "name": "Prescribed peanuts.",
    "original": "限定款花生",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift37.webp",
    "description_en": "Very rare miniature figurine with data storage and volume control features. Since it's based on the feline Peanut, it's popular among cat lovers. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Очень редкая миниатюрная фигурка с функциями хранения данных и регулировки громкости. Поскольку за основу для нее взята кошка Арахис, она популярна среди любителей кошек. Производится в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "55": {
    "id": "Item_gift_3014",
    "name": "The vanity of angels.",
    "original": "虚无天使手办",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift40.webp",
    "description_en": "A miniature figurine based on the Void Angel. It's white all over and requires special care to keep spotless. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Миниатюрная фигурка, за основу для которой взят ангел пустоты. Она белого цвета, поэтому требуется применять особый уход, чтобы содержать ее в чистоте. Производится в Асперии, и симулякры из других регионов могут не заинтересоваться ей."
  },
  "56": {
    "id": "Item_gift_3015",
    "name": "Angela, put this on.",
    "original": "安吉拉摆件",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/ImitationGift/gift39.webp",
    "description_en": "A miniature replica of Angela, the smart servant, that even includes the pair of cute pink wings on her back. Produced in Aesperia, and Simulacra from other regions may not be interested in it.",
    "description_ru": "Миниатюрная копия Анжелы, умной прислуги, у которой даже есть милые розовые крылышки на спине. Произведена в Асперии, и симулякры из других регионов могут ею не заинтересоваться."
  },
  "57": {
    "id": "breakthrough_show_abcd1",
    "name": "Random weapons break through materials",
    "original": "随机武器突破材料",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/gift_gem_p2_2.webp",
    "description_en": "随机武器突破材料",
    "description_ru": "随机武器突破材料"
  },
  "58": {
    "id": "breakthrough_show_abcd2",
    "name": "Random weapons break through materials",
    "original": "随机武器突破材料",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/gift_gem_p2_2.webp",
    "description_en": "随机武器突破材料",
    "description_ru": "随机武器突破材料"
  },
  "59": {
    "id": "breakthrough_show_abcd3",
    "name": "Random weapons break through materials",
    "original": "随机武器突破材料",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/gift_gem_p2_2.webp",
    "description_en": "随机武器突破材料",
    "description_ru": "随机武器突破材料"
  },
  "60": {
    "id": "breakthrough_show_bd1",
    "name": "Random weapons break through materials",
    "original": "随机武器突破材料",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/gift_gem_p2_2.webp",
    "description_en": "随机武器突破材料",
    "description_ru": "随机武器突破材料"
  },
  "61": {
    "id": "breakthrough_show_bd2",
    "name": "Random weapons break through materials",
    "original": "随机武器突破材料",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/gift_gem_p2_2.webp",
    "description_en": "随机武器突破材料",
    "description_ru": "随机武器突破材料"
  },
  "62": {
    "id": "breakthrough_show_bd3",
    "name": "Random weapons break through materials",
    "original": "随机武器突破材料",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/gift_gem_p2_2.webp",
    "description_en": "随机武器突破材料",
    "description_ru": "随机武器突破材料"
  },
  "63": {
    "id": "matrix_show_n",
    "name": "Random N Will Chip",
    "original": "随机N意志芯片",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/yizhi/256/icon_matrix_N1_256.webp",
    "description_en": "随机N意志芯片",
    "description_ru": "随机N意志芯片"
  },
  "64": {
    "id": "matrix_show_r",
    "name": "Random R Will Chip",
    "original": "随机R意志芯片",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/yizhi/256/icon_matrix_R7_256.webp",
    "description_en": "随机R意志芯片",
    "description_ru": "随机R意志芯片"
  },
  "65": {
    "id": "matrix_show_sr",
    "name": "Random SR Will Chip",
    "original": "随机SR意志芯片",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/yizhi/256/icon_matrix_SR12_256.webp",
    "description_en": "Possible Rewards: Robarg: Matrix, Apophis: Matrix, Frost Bot: Matrix, Sobek: Matrix, Barbarossa: Matrix, Pepper: Matrix, Hilda: Matrix, Ene: Matrix, Bai Ling: Matrix, Echo: Matrix.",
    "description_ru": "Возможные награды. Матрица: Робарг, матрица: Апофис, матрица: Морозный бот, матрица: Собек, матрица: Барбаросса, матрица: Пеппер, матрица: Хильда, матрица: Ина, матрица: Бай Лин, матрица: Эхо."
  },
  "66": {
    "id": "matrix_show_ssr",
    "name": "Random SSR Will Chip",
    "original": "随机SSR意志芯片",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/yizhi/256/icon_matrix_SSR1_256.webp",
    "description_en": "Possible Rewards: Meryl Matrix, Tsubasa Matrix, Cocoritter Matrix, KING Matrix, Shiro Matrix, Zero Matrix, Samir Matrix, Huma Matrix, Crow Matrix.",
    "description_ru": "Возможные награды: матрица Мерил, матрица Цубасы, матрица Коко Риттер, матрица Кинга, матрица Широ, матрица Зеро, матрица Самир, матрица Юмы, матрица Кроу."
  },
  "68": {
    "id": "breakfate_healingposition_M",
    "name": "Advanced first aid kit",
    "original": "高级急救包",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/UI_icon_chiji_jijiu2_128.webp",
    "description_en": "A package filled with first-aid supplies to treat wounds.",
    "description_ru": "Набор с медикаментами для оказания первой помощи и обработки ран."
  },
  "73": {
    "id": "Item_Bug_001",
    "name": "Fireflies.",
    "original": "萤火虫",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_bug_001.webp",
    "description_en": "Captured and released in the night for Celine. A dancing glow in the darkness.",
    "description_ru": "Пойман и выпущен ночью для Селины. Танцующий огонек во тьме."
  },
  "74": {
    "id": "Item_Honey_001",
    "name": "Honey.",
    "original": "蜂蜜",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Honey_001.webp",
    "description_en": "Everybody's favorite sweet. Only the bees have to work hard.",
    "description_ru": "Всеми любимая сладость. Только пчелам приходится для него немало потрудиться."
  },
  "75": {
    "id": "Item_Honey_002",
    "name": "Bee magma.",
    "original": "蜂王浆",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Honey_002.webp",
    "description_en": "Everybody's favorite sweet. Only the bees have to work hard.",
    "description_ru": "Всеми любимая сладость. Только пчелам приходится для него немало потрудиться."
  },
  "77": {
    "id": "Item_Milk_001",
    "name": "Milk.",
    "original": "牛奶",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Milk_001.webp",
    "description_en": "A common beverage, ready to drink and may be stored for a while. A nutritious fave.",
    "description_ru": "Обычный и готовый к употреблению напиток. Молоко хранится не очень долго, но весьма питательно."
  },
  "79": {
    "id": "Item_Shell_001",
    "name": "Angular conch",
    "original": "角海螺",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/item_shells_001.webp",
    "description_en": "Legend has it a beautiful, kind girl lives inside. And it tastes pretty good.",
    "description_ru": "Легенда гласит, что внутри живет красивая и добрая девушка. И на вкус она очень хороша."
  },
  "80": {
    "id": "Item_Shell_002",
    "name": "I'm sorry.",
    "original": "惑哒贝",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/item_shells_002.webp",
    "description_en": "One of the primary food source for coastal dwellers. Already seasoned with sea salt, just grill and serve.",
    "description_ru": "Один из основных источников пищи для жителей побережья. Он уже приправлен морской солью — просто поджарьте на гриле и подавайте."
  },
  "81": {
    "id": "Item_Shells_003",
    "name": "Snail-eating.",
    "original": "食腐蜗牛",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Shells_003.webp",
    "description_en": "A rare variety of giant snail with a weird appetite, but is surprisingly tasty.",
    "description_ru": "Редкая разновидность гигантской улитки со странным аппетитом. При этом удивительно вкусная."
  },
  "82": {
    "id": "Item_Shells_005",
    "name": "The sojourn crab.",
    "original": "寄居蟹",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Shells_005.webp",
    "description_en": "It has grown again! And now it gets a new... steamy \"house.\"",
    "description_ru": "Он снова вырос! И теперь у него новый... паровой «дом»."
  },
  "85": {
    "id": "Item_Meat_003",
    "name": "Back legs.",
    "original": "后腿肉",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Meat_003.webp",
    "description_en": "Delicious when grilled or roasted. Goes well with mustard.",
    "description_ru": "Вкусно, если пожарить на гриле или запечь в духовке. Хорошо сочетается с горчицей."
  },
  "86": {
    "id": "Item_Meat_004",
    "name": "It's a beast.",
    "original": "紧致兽肉",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Meat_004.webp",
    "description_en": "The more the beast moved, the better the meat.",
    "description_ru": "Чем больше зверь двигался, тем лучше его мясо."
  },
  "87": {
    "id": "Item_Meat_005",
    "name": "A lot of fat.",
    "original": "多脂兽肉",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Meat_005.webp",
    "description_en": "The less the beast moved, the fattier the meat.",
    "description_ru": "Чем меньше зверь двигался, тем его мясо жирнее."
  },
  "90": {
    "id": "Item_Greens_002",
    "name": "Wilderball.",
    "original": "野生球菜",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Greens_002.webp",
    "description_en": "It resembles a ball, but that doesn't mean you can kick it like one.",
    "description_ru": "Она похожа на мяч, но это не значит, что ее можно пинать ногой."
  },
  "91": {
    "id": "Item_Greens_003",
    "name": "A broccoli.",
    "original": "西兰花",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Greens_003.webp",
    "description_en": "Nutritious, and every kid loves it.",
    "description_ru": "Питательная, и все дети ее любят."
  },
  "95": {
    "id": "Item_Mushroom_002",
    "name": "Gicassomium",
    "original": "基卡松菌",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/item_mushroom_002.webp",
    "description_en": "Sprouts toward the sun only after raining. Supposedly tastes like sunshine.",
    "description_ru": "Вылезают на свет только после дождя. Говорят, что на вкус они — как солнечный свет."
  },
  "96": {
    "id": "Item_Mushroom_004",
    "name": "Foul.",
    "original": "火耳",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Mushroom_004.webp",
    "description_en": "Seems to be a variety of woodear fungus transformed by elements of flame. Tastes rather spicy.",
    "description_ru": "Похоже, что эту разновидность древесного гриба преобразовала стихия огня. На вкус гриб довольно острый."
  },
  "97": {
    "id": "Item_Mushroom_005",
    "name": "Monkey-head mushrooms.",
    "original": "猴头菇",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Mushroom_005.webp",
    "description_en": "Bland in both taste and appearance, but allegedly very high in nutrients.",
    "description_ru": "Бледный как на вид, так и на вкус, но, как утверждается, очень богатый питательными веществами."
  },
  "98": {
    "id": "Item_Mushroom_006",
    "name": "Black truffles.",
    "original": "黑松露",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Mushroom_006.webp",
    "description_en": "Rare and expensive mushroom that grows in rather specific, stringent environments.",
    "description_ru": "Редкий и дорогой гриб, который растет в довольно специфических жестких условиях."
  },
  "99": {
    "id": "Item_Mushroom_007",
    "name": "Ghost mushrooms.",
    "original": "幽灵菇",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Mushroom_007.webp",
    "description_en": "Fungi indigenous to caves. You'll be seeing stars after massive consumption.",
    "description_ru": "Грибы, растущие в пещерах. Съешьте их слишком много — и увидите звезды."
  },
  "102": {
    "id": "Item_Staples_002",
    "name": "Chimiki-Mac.",
    "original": "赤米基麦",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/item_staples_002.webp",
    "description_en": "An offshoot of homi grain that contains the power of the flame element.",
    "description_ru": "Разновидность зерна хоми, содержащая силу стихии огня."
  },
  "103": {
    "id": "Item_Staples_003",
    "name": "White potatoes.",
    "original": "白薯",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Staples_003.webp",
    "description_en": "Tastes great when baked, but eating too much of it won't make you pleasant around other people.",
    "description_ru": "У печеного картофеля прекрасный вкус, но если съесть его слишком много, с вами будет не очень приятно общаться."
  },
  "104": {
    "id": "Item_Staples_005",
    "name": "Sparrow potatoes.",
    "original": "雀头薯",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Staples_005.webp",
    "description_en": "A variety of potatoes that were exposed to radiation. Extremely nutritious.",
    "description_ru": "Разновидность картофеля, подвергшегося воздействию радиации. Чрезвычайно питателен."
  },
  "106": {
    "id": "Item_Fishes_002",
    "name": "Lei-eon.",
    "original": "雷鳗",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/item_fishes_002.webp",
    "description_en": "Two words: 12 volts!!!",
    "description_ru": "Два слова: 12 вольт!"
  },
  "107": {
    "id": "Item_Fruit_001",
    "name": "The fruit.",
    "original": "落果",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Orange.webp",
    "description_en": "Fruit fallen to the ground. Edible if you clean the mud off.",
    "description_ru": "Плоды, упавшие на землю. Съедобны, если очистить их от грязи."
  },
  "108": {
    "id": "Item_Fruit_002",
    "name": "Strawberry.",
    "original": "草莓",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Fruit_002.webp",
    "description_en": "Don't wait for it to ripen, or it would be eaten by wild animals long before that.",
    "description_ru": "Не ждите, пока она созреет. Дикие звери задолго до этого съедят все подчистую."
  },
  "109": {
    "id": "Item_Fruit_003",
    "name": "Phosphorus pomegranate",
    "original": "磷光石榴",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Fruit_003.webp",
    "description_en": "After the initial sour-sweet taste comes... blandness, yet it's a waste to throw it away.",
    "description_ru": "После яркого кисло-сладкого первого укуса идет безвкусная мякоть... но выбрасывать ее не хочется."
  },
  "110": {
    "id": "Item_Fruit_004",
    "name": "The Dragon Goll.",
    "original": "炎龙果",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Fruit_004.webp",
    "description_en": "Upgraded dragon fruit with double nutrients, though eating too much of it makes you aggressive.",
    "description_ru": "Улучшенный драконий фрукт, в котором вдвое больше питательных веществ. Его чрезмерное употребление делает вас агрессивным!"
  },
  "111": {
    "id": "Item_Follows002",
    "name": "Snow thugs.",
    "original": "雪鹃",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Follows_002_sp.webp",
    "description_en": "Extremely high in medicinal value without side effects. Consume as much as you want.",
    "description_ru": "Исключительно высокая лекарственная ценность без побочных эффектов. Принимайте, сколько хотите."
  },
  "112": {
    "id": "Item_Fruits008",
    "name": "Oilmelon.",
    "original": "油瓜",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Fruit_008.webp",
    "description_en": "Tastes pretty good, actually, despite the irradiated appearance.",
    "description_ru": "Облученный плод выглядит так себе, но вкус отменный."
  },
  "113": {
    "id": "Item_Nuts004",
    "name": "Pyroscopes.",
    "original": "光核桃",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Nuts_004.webp",
    "description_en": "Eat more of it if you want to become smarter.",
    "description_ru": "Ешьте больше, если хотите стать умнее."
  },
  "114": {
    "id": "Item_Greens012",
    "name": "Wormgrass.",
    "original": "虫草",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Greens_012.webp",
    "description_en": "What's the caterpillar sprouting!?",
    "description_ru": "Что это такое растет из гусеницы?!"
  },
  "115": {
    "id": "Item_Follows001",
    "name": "Snow Lotus.",
    "original": "雪莲花",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Follows_001.webp",
    "description_en": "Whoa! What a big ole white cabbage!",
    "description_ru": "Ух ты! Какой большой белый кочан!"
  },
  "116": {
    "id": "Item_Staples006",
    "name": "Cyanium",
    "original": "青稞",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Staples_006.webp",
    "description_en": "No one's farming anymore, leaving it to grow in the wild as it may.",
    "description_ru": "Ячмень больше никто не выращивает, и он сам по себе растет в дикой природе."
  },
  "117": {
    "id": "Item_Greens011",
    "name": "Pyroscope.",
    "original": "黒藓",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Greens_011.webp",
    "description_en": "Grows on the exposed cliff face. It's edible, at least.",
    "description_ru": "Растет на открытых участках скал. По крайней мере, съедобен."
  },
  "118": {
    "id": "Item_Nuts003",
    "name": "Pinechop.",
    "original": "松果",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Nuts_003.webp",
    "description_en": "An apple might not be the only thing that drops on your head. It could be a pinecone.",
    "description_ru": "С дерева вам на голову может свалиться не только яблоко. Это может быть и кедровая шишка."
  },
  "119": {
    "id": "Item_Greens010",
    "name": "Peat-peat-peat.",
    "original": "泥炭藓",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Greens_010.webp",
    "description_en": "The best choice for detox, though it has a weird taste.",
    "description_ru": "Лучше всего подходит для вывода токсинов, хоть у него и странный вкус."
  },
  "120": {
    "id": "Item_Shells009",
    "name": "Vault.",
    "original": "藤壶",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Shells_009.webp",
    "description_en": "Looks scary, but yummy to the tongue!",
    "description_ru": "Выглядит устрашающе, но на деле необычайно вкусный!"
  },
  "121": {
    "id": "Item_Fishes006",
    "name": "Dat's thug.",
    "original": "达氏鲟",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Fishes_006.webp",
    "description_en": "Sturgeon living in shallow waters. Small in size, great for braising or stew.",
    "description_ru": "Осетр, обитающий на мелководье. Он небольшого размера, так что отлично подходит для тушения или рагу."
  },
  "122": {
    "id": "Item_Fishes005",
    "name": "Lake Harmon.",
    "original": "雷克鲑",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Fishes_005.webp",
    "description_en": "This fish is good any way you cook it.",
    "description_ru": "Эта рыба хороша, как ее ни приготовь."
  },
  "123": {
    "id": "Item_Nuts002",
    "name": "Coco beans.",
    "original": "可可豆",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Nuts_002.webp",
    "description_en": "Do you anticipate chocolate when you see the cocoa beans too?",
    "description_ru": "Вы тоже думаете о шоколаде, когда видите бобы какао?"
  },
  "124": {
    "id": "Item_Nuts001",
    "name": "The scorpion.",
    "original": "榛子",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Nuts_001.webp",
    "description_en": "A certain account pegs this as the culprit of the cracking of tectonic plates during Ice Age.",
    "description_ru": "По некоторым данным, именно он стал виновником расхождения тектонических плит во время ледникового периода."
  },
  "125": {
    "id": "Item_Greens009",
    "name": "Fish grass.",
    "original": "鱼腥草",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Greens_009.webp",
    "description_en": "If you can stand the taste, you can't get enough of it.",
    "description_ru": "Те, кто способны вынести ее вкус, просто не могут от нее оторваться."
  },
  "126": {
    "id": "Item_Greens008",
    "name": "The ricin.",
    "original": "蕨菜",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Greens_008.webp",
    "description_en": "Time to eat your veggie! Won't grow tall if you're finicky!",
    "description_ru": "Пора есть зелень! Кто привередничает — не вырастет большим и сильным!"
  },
  "127": {
    "id": "Item_Greens007",
    "name": "Purple.",
    "original": "紫菜",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Greens_007.webp",
    "description_en": "A variety of kelp. Easily washed ashore by waves.",
    "description_ru": "Разновидность водорослей. Такие часто выбрасывает волнами на берег."
  },
  "128": {
    "id": "Item_Shells008",
    "name": "Oysters.",
    "original": "牡蛎",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Shells_008.webp",
    "description_en": "A favorite of the luminaries in the city. Rumors circulate about it having special effects.",
    "description_ru": "Любимое лакомство городских толстосумов. Ходят слухи, что устрицы обладают особыми свойствами."
  },
  "129": {
    "id": "Item_Shells007",
    "name": "Sea urchins.",
    "original": "海胆",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Shells_007.webp",
    "description_en": "A delicacy from the shallow edge of the sea, though not for everyone.",
    "description_ru": "Деликатес с морского мелководья. Надо признаться, он не всем по вкусу."
  },
  "130": {
    "id": "Item_Shells006",
    "name": "Sheraki crab.",
    "original": "梭子蟹",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Shells_006.webp",
    "description_en": "Lives on the shallow edge of the sea and sometimes comes ashore to soak up the sun. Very delicious.",
    "description_ru": "Живет на мелководье и иногда выходит на берег, чтобы понежиться на солнце. Очень вкусный."
  },
  "131": {
    "id": "Item_Fruits009",
    "name": "Balloon fruit.",
    "original": "气球果",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Fruit_007.webp",
    "description_en": "The matured form goes wherever the wind takes it.",
    "description_ru": "Созревшие плоды улетают туда, куда несет их ветер."
  },
  "132": {
    "id": "Item_Fruits006",
    "name": "A hedgehog tomato.",
    "original": "刺猬番茄",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Fruit_006.webp",
    "description_en": "This new variety of tomato is not to be missed.",
    "description_ru": "Этот новый сорт помидоров не стоит упускать из виду."
  },
  "133": {
    "id": "Item_Drugs_001",
    "name": "Beast palms.",
    "original": "兽掌",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Drugs_001.webp",
    "description_en": "An enemy's paw with long claws for that extra crunch.",
    "description_ru": "Лапа врага с длинными когтями, добавляющими аппетитный хруст."
  },
  "134": {
    "id": "Item_Drugs_002",
    "name": "The eggs of mutants.",
    "original": "变异之卵",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Drugs_002.webp",
    "description_en": "Wonder what's inside...? Wow, yummy!",
    "description_ru": "Интересно, что внутри?.. Ух ты, вкуснятина!"
  },
  "136": {
    "id": "Item_Drugs_004",
    "name": "Mechanical heart.",
    "original": "机械心脏",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "description_en": "It is said to taste better if you make it sweet-and-sour.",
    "description_ru": "Считается, что оно будет вкуснее, если приготовить его кисло-сладким."
  },
  "150": {
    "id": "Item_Condiment_02",
    "name": "Soybeans.",
    "original": "黄豆",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Condiment_02.webp",
    "description_en": "One of the popular emergency provisions and the main ingredient for various products. Take it straight and you might get the runs.",
    "description_ru": "Один из популярных продуктов на черный день и основной ингредиент для различных блюд. Если же есть ее просто так, то вас может прослабить."
  },
  "152": {
    "id": "Item_Condiment_04",
    "name": "Mustard.",
    "original": "芥末",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Condiment_04.webp",
    "description_en": "A condiment appreciated by those who seem to prefer choking while eating their food... Gak!",
    "description_ru": "Приправа, которую ценят те, кто, похоже, любит давиться во время еды... Уф!"
  },
  "153": {
    "id": "Item_Condiment_05",
    "name": "Onions.",
    "original": "洋葱",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Greens_005.webp",
    "description_en": "Nutritious and full of flavor, teary eyes are the price for preparation, though.",
    "description_ru": "Очень полезный и с ярким вкусом, но плата за приготовление — слезящиеся глаза."
  },
  "157": {
    "id": "Item_Mushroom_0031",
    "name": "Umbrella",
    "original": "伞状菌",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/item_mushroom_002.webp",
    "description_en": "Has a very distinct taste and is incredibly delicious.",
    "description_ru": "Очень выраженный, по-настоящему деликатесный вкус."
  },
  "159": {
    "id": "Item_Mushroom_0042",
    "name": "Mueul.",
    "original": "木耳",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Mushroom_004.webp",
    "description_en": "What? You never had it before? You're missing out, my friend!",
    "description_ru": "Что? Вы никогда не пробовали его раньше? Это огромное упущение!"
  },
  "160": {
    "id": "Item_Fishes0051",
    "name": "Jell-O-R-R-R-R-R-A-R-A-R.",
    "original": "哲罗鲑",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Fishes_005.webp",
    "description_en": "Omnivorous fish with a very long maturity cycle, can grow up to 2 meters.",
    "description_ru": "Всеядная рыба с очень длинным периодом созревания. Может вырастать до двух метров в длину."
  },
  "162": {
    "id": "Item_Fruit_0021",
    "name": "Snakeberries.",
    "original": "蛇莓",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Fruit_002.webp",
    "description_en": "A dead ringer for strawberry with a similar flavor.",
    "description_ru": "Как две капли воды похожая на землянику ягода с похожим вкусом."
  },
  "163": {
    "id": "Item_Meat_006",
    "name": "It's a beast.",
    "original": "紧致兽肉",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Meat_001.webp",
    "description_en": "The more the beast moved, the better the meat.",
    "description_ru": "Чем больше зверь двигался, тем лучше его мясо."
  },
  "164": {
    "id": "Item_Staples_0031",
    "name": "Snow and white potatoes.",
    "original": "雪切白薯",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Staples_003.webp",
    "description_en": "Tastes great when baked, but eating too much of it won't make you pleasant around other people.",
    "description_ru": "У печеного картофеля прекрасный вкус, но если съесть его слишком много, с вами будет не очень приятно общаться."
  },
  "166": {
    "id": "Item_Follows0011",
    "name": "Snowflake.",
    "original": "雪菜花",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/shicai/Item_Follows_001.webp",
    "description_en": "Whoa! What a big ole white cabbage!",
    "description_ru": "Ух ты! Какой большой белый кочан!"
  },
  "178": {
    "id": "Item_Diamond",
    "name": "Tian Jing",
    "original": "钛晶",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/huobi/diamonds.webp",
    "description_en": "Stable crystals, most commonly used for energy supply. One of the currencies redeemable for items in the Store.",
    "description_ru": "Стабильные кристаллы, чаще всего используемые для получения энергии. Служат валютой, и их можно обменять на предметы в магазине."
  },
  "179": {
    "id": "Item_Artifact_updata",
    "name": "Original Alloy",
    "original": "原能合金",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/huobi/yuannengsuipian.webp",
    "description_en": "The latest metal material made from multiple types of metals with Omnium with good hardness, quality, and ductility. Mostly used for refining high-tech weapons and machines.",
    "description_ru": "Новейший металлический материал, сплавленный из нескольких металлов и омния. Отличается высоким качеством, твердостью и пластичностью. В основном используется для усиления высокотехнологичного оружия и машин."
  },
  "180": {
    "id": "Item_FakeDiamond",
    "name": "Morking.",
    "original": "墨晶",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/huobi/fakediamonds.webp",
    "description_en": "Contains unstable energy and is sometimes used as a power source. One of the currencies redeemable for items in the Store.",
    "description_ru": "Содержит нестабильную энергию и иногда используется для получения энергии. Служит валютой, и его можно обменять на предметы в магазине."
  },
  "184": {
    "id": "item_ticket_01",
    "name": "Retrieval of documents",
    "original": "检索凭证",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/huobi/item_ticket_01.webp",
    "description_en": "From Banges Tech, Matrix chip home delivery available.",
    "description_ru": "Из компании «БэнджиТех». Доступна доставка матричного чипа на дом."
  },
  "191": {
    "id": "Item_Mine001",
    "name": "Iron ore",
    "original": "铁矿",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Item_Mine_Crystal.webp",
    "description_en": "Crystal",
    "description_ru": "Кристалл"
  },
  "199": {
    "id": "Item_Mine_fire",
    "name": "The hot core.",
    "original": "炙热之核",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Item_Mine_firepatch001.webp",
    "description_en": "Shards with fire elemental power, give off a slight heat when melted down.",
    "description_ru": "Обломки, наполненные силой стихии огня; при плавлении выделяют слабое тепло."
  },
  "202": {
    "id": "Item_Mine_ice",
    "name": "The frozen core.",
    "original": "冰冻之核",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Item_Mine_icepatch002.webp",
    "description_en": "Shards with ice elemental power, clear as a crystal.",
    "description_ru": "Обломки, наполненные силой стихии льда, прозрачные, как хрусталь."
  },
  "205": {
    "id": "Item_Mine_thunder",
    "name": "Magnetic Nucle",
    "original": "磁能之核",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Item_Mine_thunderpatch003.webp",
    "description_en": "Shards with volt elemental power, glow faintly in the dark.",
    "description_ru": "Обломки со стихийной силой электричества, слабо светящиеся в темноте."
  },
  "208": {
    "id": "Item_Mine_physic",
    "name": "The rock core.",
    "original": "岩石之核",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Item_mine_physic.webp",
    "description_en": "Extremely hard shards formed under Omnium's influence, with a drab appearance.",
    "description_ru": "Очень твердые невзрачного вида обломки, сформированные под влиянием омния."
  },
  "213": {
    "id": "Item_breakthrough_A3",
    "name": "Nano-Practical Type III",
    "original": "纳米涂层Ⅲ型",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/zujian/gem_p1_FireAtkAdded_3.webp",
    "description_en": "Coating developed from exclusive Hykros technology to greatly improve weapon performance.",
    "description_ru": "Разработанное на основе уникальной технологии Гикроса покрытие, значительно улучшающее показатели оружия."
  },
  "216": {
    "id": "Item_breakthrough_B3",
    "name": "Type III corrosion resistant film",
    "original": "抗蚀薄膜Ⅲ型",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/zujian/gem_p4_PhyAtkAdded_3.webp",
    "description_en": "Glaze developed from exclusive Hykros technology to greatly improve weapon performance.",
    "description_ru": "Разработанный на основе уникальной технологии Гикроса лак, значительно улучшающий показатели оружия."
  },
  "218": {
    "id": "Item_breakthrough_C2",
    "name": "Alloy Enhanced Framework II",
    "original": "合金增强框架Ⅱ型",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/zujian/gem_p3_IceDefAdded_2.webp",
    "description_en": "Redeveloped frame after more research to improve weapon performance.",
    "description_ru": "Переработанное после дополнительных исследований основание, улучшающее показатели оружия."
  },
  "219": {
    "id": "Item_breakthrough_C3",
    "name": "UEF-III",
    "original": "合金增强框架Ⅲ型",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/zujian/gem_p3_IceDefAdded_3.webp",
    "description_en": "Fortified framework developed from exclusive Hykros technology to greatly improve weapon performance.",
    "description_ru": "Разработанное на основе уникальной технологии Гикроса укрепленное основание, значительно улучшающее показатели оружия."
  },
  "221": {
    "id": "Item_breakthrough_D2",
    "name": "Nanofibre framework II",
    "original": "纳米纤维框架Ⅱ型",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/zujian/Item_breakthrough_D2.webp",
    "description_en": "Redeveloped premium frame after more research to improve weapon performance.",
    "description_ru": "Переработанное после дополнительных исследований высококачественное основание, улучшающее показатели оружия."
  },
  "222": {
    "id": "Item_breakthrough_D3",
    "name": "Nanofibre framework III",
    "original": "纳米纤维框架Ⅲ型",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/zujian/Item_breakthrough_D3.webp",
    "description_en": "Premium framework developed from exclusive Hykros technology to greatly improve weapon performance.",
    "description_ru": "Разработанное на основе уникальной технологии Гикроса высококачественное основание, значительно улучшающее показатели оружия."
  },
  "223": {
    "id": "hardware_001",
    "name": "Trident",
    "original": "三角齿轮",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Mount_Strengthen_1_3.webp",
    "description_en": "The most essential parts to support the functioning of machines.",
    "description_ru": "Наиболее важные детали, обеспечивающие функционирование машин."
  },
  "229": {
    "id": "Mount_Strengthen_1_1",
    "name": "E53 coolant.",
    "original": "E53冷却液",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Mount_Strengthen_1_4.webp",
    "description_en": "A must for vehicle maintenance, also extends generator or engine life.",
    "description_ru": "Необходим для технического обслуживания транспорта, а также продлевает срок службы генератора или двигателя."
  },
  "230": {
    "id": "Mount_Strengthen_1_2",
    "name": "FF79 alloy oil",
    "original": "FF79合金机油",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Mount_Strengthen_1_5.webp",
    "description_en": "Composite lubricant that lasts longer than ordinary lubricants and is environmentally friendly.",
    "description_ru": "Композитный смазочный материал, который служит дольше обычного и является экологически чистым."
  },
  "231": {
    "id": "Mount_Strengthen_1_3",
    "name": "High-intensity gear",
    "original": "高强度齿轮",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Mount_Strengthen_1_3.webp",
    "description_en": "Very durable alloy gears able to withstand constant operation. A must for vehicle improvement.",
    "description_ru": "Очень прочные шестерни из сплава, способные выдерживать постоянную нагрузку. Необходимы для улучшения транспорта."
  },
  "241": {
    "id": "Mount_Strengthen_4_1",
    "name": "The core of supply",
    "original": "供能核心",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Mount_Strengthen_3_4.webp",
    "description_en": "A very expensive high-tech component, safe and efficient because it blocks radiation while supplying massive Omnium energy.",
    "description_ru": "Очень дорогой высокотехнологичный компонент, безопасный и эффективный. Блокирует излучение, одновременно предоставляя доступ к мощной энергии омния."
  },
  "242": {
    "id": "Mount_Strengthen_4_2",
    "name": "Titanium engine shield.",
    "original": "钛金引擎保护壳",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Mount_Strengthen_3_1.webp",
    "description_en": "Metal hull for engines. Highly-durable, lightweight, corrosion-resistant, and especially popular in regions with adverse environments.",
    "description_ru": "Металлический корпус машины. Прочный, легкий, устойчивый к коррозии и особенно популярный в регионах с суровыми условиями."
  },
  "243": {
    "id": "Mount_Strengthen_4_3",
    "name": "Hamlint bearings.",
    "original": "汉姆林特制轴承",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Mount_Strengthen_4_3.webp",
    "description_en": "Created by the Crown Mines scientist Hamlin to greatly improve a vehicle's energy efficiency, thus enhancing its performance.",
    "description_ru": "Создан ученым Гамлином из шахт Крауна. Позволяет значительно повысить энергетическую эффективность транспорта и за счет этого улучшить показатели."
  },
  "244": {
    "id": "Mount_Strengthen_4_4",
    "name": "Engine V",
    "original": "发动机V型",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Mount_Strengthen_4_4.webp",
    "description_en": "Advanced engine developed by Banges's famous vehicle researcher, Dr. V, who personally oversees the production of every unit, hence its rarity.",
    "description_ru": "Усовершенствованный двигатель, разработанный знаменитым исследователем транспорта из Бэнджи, доктором Ви. Доктор лично контролирует производство каждой единицы, поэтому они такие редкие."
  },
  "247": {
    "id": "choose_ssr",
    "name": "SSR Source Box",
    "original": "SSR源器箱",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/gift_artifact_ssr.webp",
    "description_en": "General box",
    "description_ru": "Ящик общего назначения"
  },
  "250": {
    "id": "choose_frag_ssr",
    "name": "SSR Source Debris Box",
    "original": "SSR源器碎片箱",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/gift_artifact_frag_ssr.webp",
    "description_en": "General box",
    "description_ru": "Ящик общего назначения"
  },
  "253": {
    "id": "choose_elemine_p3",
    "name": "Element ore boxes",
    "original": "元素矿石箱",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/treasure_choose.webp",
    "description_en": "A box containing a selection of elemental ore to choose from.",
    "description_ru": "Ящик, содержащий руду стихий на выбор."
  },
  "262": {
    "id": "choose_matrix_SSR1",
    "name": "Meryl will choose the box.",
    "original": "梅丽尔意志自选箱",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/treasure_matrix_ssr1.webp",
    "description_en": "A box containing all Meryl Matrices.",
    "description_ru": "Ящик, содержащий все матрицы Мерил."
  },
  "263": {
    "id": "choose_matrix_SSR2",
    "name": "The Four Maple House will choose the box.",
    "original": "四枫院羽意志自选箱",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/treasure_matrix_ssr2.webp",
    "description_en": "A box containing all Tsubasa Matrices.",
    "description_ru": "Ящик, содержащий все матрицы Цубасы."
  },
  "264": {
    "id": "choose_matrix_SSR3",
    "name": "Cottler's Will is in the box.",
    "original": "可可丽特意志自选箱",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/treasure_matrix_ssr3.webp",
    "description_en": "A box containing all Cocoritter Matrices.",
    "description_ru": "Ящик, содержащий все матрицы Коко Риттер."
  },
  "265": {
    "id": "choose_matrix_SSR4",
    "name": "King's Will is in the box.",
    "original": "King意志自选箱",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/treasure_matrix_ssr4.webp",
    "description_en": "A box containing all KING Matrices.",
    "description_ru": "Ящик, содержащий все матрицы Кинга."
  },
  "266": {
    "id": "choose_matrix_SSR5",
    "name": "Cobalt Blue Will Select Box",
    "original": "钴蓝意志自选箱",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/treasure_matrix_ssr5.webp",
    "description_en": "A box containing all Cobalt-B Matrices.",
    "description_ru": "Ящик, содержащий все матрицы Кобальт-Би."
  },
  "267": {
    "id": "choose_matrix_SSR6",
    "name": "Claudia will choose the box.",
    "original": "克劳迪娅意志自选箱",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/treasure_matrix_ssr6.webp",
    "description_en": "A box containing all Claudia Matrices.",
    "description_ru": "Ящик, содержащий все матрицы Клаудии."
  },
  "5793": {
    "id": "imitation_fashion_43",
    "name": "The sun is so hot.",
    "original": "霜花盛夏",
    "rename": "Ling Han Summer skin",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/icon_linghan02.webp",
    "description_en": "Basking under the brilliant sun, the Summer Frost blooms.",
    "description_ru": "Под яркими лучами солнца расцветает летний иней."
  },
  "5794": {
    "id": "imitation_fashion_43_w",
    "name": "Flowers",
    "original": "花涧",
    "rename": "Ling Han Summer weapon skin",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/icon_linghan01.webp",
    "description_en": "Atop the waves, where snowflakes dance.",
    "description_ru": "На пенном гребне волны танцуют снежинки."
  }
};

export const BASELINE_MMO_ITEMS: Record<string, any> = {
  "1": {
    "id": "BluePrint_T0.2_Equip1",
    "name": "A assault arm armor drawings.",
    "original": "突击臂甲图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_2_Equip1.webp",
    "description_en": "突击臂甲图纸",
    "description_ru": "突击臂甲图纸"
  },
  "2": {
    "id": "BluePrint_T0.2_Equip2",
    "name": "Assault leg drawings.",
    "original": "突击护腿图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_2_Equip2.webp",
    "description_en": "突击护腿图纸",
    "description_ru": "突击护腿图纸"
  },
  "3": {
    "id": "BluePrint_T0.2_Equip3",
    "name": "Assault Shoe Drawings",
    "original": "突击鞋图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_2_Equip3.webp",
    "description_en": "突击鞋图纸",
    "description_ru": "突击鞋图纸"
  },
  "4": {
    "id": "BluePrint_T0.2_Equip4",
    "name": "Surf shoulder drawings",
    "original": "突击护肩图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_2_Equip4.webp",
    "description_en": "突击护肩图纸",
    "description_ru": "突击护肩图纸"
  },
  "5": {
    "id": "BluePrint_T0.2_Equip5",
    "name": "Assaulting A drawings.",
    "original": "突击护甲图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_2_Equip5.webp",
    "description_en": "突击护甲图纸",
    "description_ru": "突击护甲图纸"
  },
  "6": {
    "id": "BluePrint_T0.2_Equip6",
    "name": "Assault Handpaper",
    "original": "突击护手图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_2_Equip6.webp",
    "description_en": "突击护手图纸",
    "description_ru": "突击护手图纸"
  },
  "7": {
    "id": "BluePrint_T0.2_Equip7",
    "name": "A belt of assault drawings.",
    "original": "突击腰带图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_2_Equip7.webp",
    "description_en": "突击腰带图纸",
    "description_ru": "突击腰带图纸"
  },
  "8": {
    "id": "BluePrint_T0.2_Equip8",
    "name": "Assault helmet drawings",
    "original": "突击头盔图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_2_Equip8.webp",
    "description_en": "突击头盔图纸",
    "description_ru": "突击头盔图纸"
  },
  "9": {
    "id": "BluePrint_T0.3_Equip1",
    "name": "Extinct arm's apnear drawings",
    "original": "歼灭臂甲图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_3_Equip1.webp",
    "description_en": "歼灭臂甲图纸",
    "description_ru": "歼灭臂甲图纸"
  },
  "10": {
    "id": "BluePrint_T0.3_Equip2",
    "name": "Extermination leg drawings",
    "original": "歼灭护腿图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_3_Equip2.webp",
    "description_en": "歼灭护腿图纸",
    "description_ru": "歼灭护腿图纸"
  },
  "11": {
    "id": "BluePrint_T0.3_Equip3",
    "name": "Shoe-killing drawings",
    "original": "歼灭鞋图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_3_Equip3.webp",
    "description_en": "歼灭鞋图纸",
    "description_ru": "歼灭鞋图纸"
  },
  "12": {
    "id": "BluePrint_T0.3_Equip4",
    "name": "Extinct shoulder drawings",
    "original": "歼灭护肩图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_3_Equip4.webp",
    "description_en": "歼灭护肩图纸",
    "description_ru": "歼灭护肩图纸"
  },
  "13": {
    "id": "BluePrint_T0.3_Equip5",
    "name": "Destroying the map.",
    "original": "歼灭护甲图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_3_Equip5.webp",
    "description_en": "歼灭护甲图纸",
    "description_ru": "歼灭护甲图纸"
  },
  "14": {
    "id": "BluePrint_T0.3_Equip6",
    "name": "Exterminate handpaper",
    "original": "歼灭护手图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_3_Equip6.webp",
    "description_en": "歼灭护手图纸",
    "description_ru": "歼灭护手图纸"
  },
  "15": {
    "id": "BluePrint_T0.3_Equip7",
    "name": "Discharge belt drawings",
    "original": "歼灭腰带图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_3_Equip7.webp",
    "description_en": "歼灭腰带图纸",
    "description_ru": "歼灭腰带图纸"
  },
  "16": {
    "id": "BluePrint_T0.3_Equip8",
    "name": "Destroy helmet drawings",
    "original": "歼灭头盔图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T0_3_Equip8.webp",
    "description_en": "歼灭头盔图纸",
    "description_ru": "歼灭头盔图纸"
  },
  "17": {
    "id": "BluePrint_T1_Equip1",
    "name": "Titan Armor Chart",
    "original": "泰坦臂甲图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T1_Equip1.webp",
    "description_en": "泰坦臂甲图纸",
    "description_ru": "泰坦臂甲图纸"
  },
  "18": {
    "id": "BluePrint_T1_Equip2",
    "name": "Titan leg-carrying paper.",
    "original": "泰坦护腿图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T1_Equip2.webp",
    "description_en": "泰坦护腿图纸",
    "description_ru": "泰坦护腿图纸"
  },
  "19": {
    "id": "BluePrint_T1_Equip3",
    "name": "Titan Shoe Chart",
    "original": "泰坦鞋图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T1_Equip3.webp",
    "description_en": "泰坦鞋图纸",
    "description_ru": "泰坦鞋图纸"
  },
  "20": {
    "id": "BluePrint_T1_Equip4",
    "name": "Titan shoulder-pumping paper.",
    "original": "泰坦护肩图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T1_Equip4.webp",
    "description_en": "泰坦护肩图纸",
    "description_ru": "泰坦护肩图纸"
  },
  "21": {
    "id": "BluePrint_T1_Equip5",
    "name": "Titan's a mandamus.",
    "original": "泰坦护甲图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T1_Equip5.webp",
    "description_en": "泰坦护甲图纸",
    "description_ru": "泰坦护甲图纸"
  },
  "22": {
    "id": "BluePrint_T1_Equip6",
    "name": "Titanian hand-writing.",
    "original": "泰坦护手图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T1_Equip6.webp",
    "description_en": "泰坦护手图纸",
    "description_ru": "泰坦护手图纸"
  },
  "23": {
    "id": "BluePrint_T1_Equip7",
    "name": "Titan belt drawings.",
    "original": "泰坦腰带图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T1_Equip7.webp",
    "description_en": "泰坦腰带图纸",
    "description_ru": "泰坦腰带图纸"
  },
  "24": {
    "id": "BluePrint_T1_Equip8",
    "name": "Titan helmet drawings",
    "original": "泰坦头盔图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T1_Equip8.webp",
    "description_en": "泰坦头盔图纸",
    "description_ru": "泰坦头盔图纸"
  },
  "25": {
    "id": "BluePrint_T2_Equip1",
    "name": "Apocalypse of Arm of the Dead",
    "original": "末日臂甲图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T2_Equip1.webp",
    "description_en": "末日臂甲图纸",
    "description_ru": "末日臂甲图纸"
  },
  "26": {
    "id": "BluePrint_T2_Equip2",
    "name": "A final leg protection drawing.",
    "original": "末日护腿图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T2_Equip2.webp",
    "description_en": "末日护腿图纸",
    "description_ru": "末日护腿图纸"
  },
  "27": {
    "id": "BluePrint_T2_Equip3",
    "name": "Apocalypse Shoes",
    "original": "末日鞋图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T2_Equip3.webp",
    "description_en": "末日鞋图纸",
    "description_ru": "末日鞋图纸"
  },
  "28": {
    "id": "BluePrint_T2_Equip4",
    "name": "Apocalypse shoulder-pumping paper",
    "original": "末日护肩图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T2_Equip4.webp",
    "description_en": "末日护肩图纸",
    "description_ru": "末日护肩图纸"
  },
  "29": {
    "id": "BluePrint_T2_Equip5",
    "name": "Apocalypse for the end of the day",
    "original": "末日护甲图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T2_Equip5.webp",
    "description_en": "末日护甲图纸",
    "description_ru": "末日护甲图纸"
  },
  "30": {
    "id": "BluePrint_T2_Equip6",
    "name": "Apocalypse Handprint",
    "original": "末日护手图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T2_Equip6.webp",
    "description_en": "末日护手图纸",
    "description_ru": "末日护手图纸"
  },
  "31": {
    "id": "BluePrint_T2_Equip7",
    "name": "Apocalypse belt drawings",
    "original": "末日腰带图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T2_Equip7.webp",
    "description_en": "末日腰带图纸",
    "description_ru": "末日腰带图纸"
  },
  "32": {
    "id": "BluePrint_T2_Equip8",
    "name": "Apocalypse helmet drawings",
    "original": "末日头盔图纸",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T2_Equip8.webp",
    "description_en": "末日头盔图纸",
    "description_ru": "末日头盔图纸"
  },
  "33": {
    "id": "BreakClash_S2_StrengthenStoneMMO_C",
    "name": "Combining Reconstruct Box",
    "original": "复合共鸣重构箱",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Bag_StrengthenStoneMMO_C_2.webp",
    "description_en": "复合共鸣重构箱",
    "description_ru": "复合共鸣重构箱"
  },
  "34": {
    "id": "choose_addin_orange_normal",
    "name": "Expand the box.",
    "original": "拓展包自选宝箱",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/chajian/s2/Box_mmo2_addin01.webp",
    "description_en": "Equipment upgrade module developed by Hykros that boosts combat abilities and offers multiple enhancements.",
    "description_ru": "Модуль улучшения снаряжения, разработанный компанией Hykros, повышает боевые возможности и предлагает множество улучшений."
  },
  "35": {
    "id": "choose_addin_orange_normal2",
    "name": "Open package 2 for your box.",
    "original": "拓展包2自选宝箱",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/chajian/s2/Box_mmo2_addin03.webp",
    "description_en": "Equipment upgrade module developed by Hykros that boosts combat abilities and offers multiple enhancements.",
    "description_ru": "Модуль улучшения снаряжения, разработанный компанией Hykros, повышает боевые возможности и предлагает множество улучшений."
  },
  "36": {
    "id": "choose_addin_orange_pvp",
    "name": "Fight - Open Boxes",
    "original": "决斗-拓展包自选宝箱",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/chajian/s2/Box_mmo2_addin05.webp",
    "description_en": "Equipment upgrade module developed by Hykros that boosts combat abilities and offers multiple enhancements.",
    "description_ru": "Модуль улучшения снаряжения, разработанный компанией Hykros, повышает боевые возможности и предлагает множество улучшений."
  },
  "37": {
    "id": "choose_addin_orange_rare",
    "name": "The extended package is a rare collection.",
    "original": "拓展包稀有自选宝箱",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/chajian/s2/Box_mmo2_addin02.webp",
    "description_en": "Equipment upgrade module developed by Hykros that boosts combat abilities and offers multiple enhancements.",
    "description_ru": "Модуль улучшения снаряжения, разработанный компанией Hykros, повышает боевые возможности и предлагает множество улучшений."
  },
  "38": {
    "id": "choose_addin_orange_rare2",
    "name": "Extension Two is a rare box of treasures.",
    "original": "拓展包2稀有自选宝箱",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/chajian/s2/Box_mmo2_addin04.webp",
    "description_en": "Equipment upgrade module developed by Hykros that boosts combat abilities and offers multiple enhancements.",
    "description_ru": "Модуль улучшения снаряжения, разработанный компанией Hykros, повышает боевые возможности и предлагает множество улучшений."
  },
  "39": {
    "id": "choose_artifact_mmo1",
    "name": "SSR Source Box",
    "original": "SSR源器箱",
    "rename": "",
    "description_en": "自选宝箱"
  },
  "40": {
    "id": "choose_frag_ssr_MMO",
    "name": "SSR Source Specs Select Box",
    "original": "SSR源器碎片自选箱",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/gift_artifact_frag_ssr.webp",
    "description_en": "General box",
    "description_ru": "Ящик общего назначения"
  },
  "41": {
    "id": "choose_StrengthenStoneMMO_A1A2",
    "name": "Selecting weapon enhancement material I",
    "original": "自选武器强化素材Ⅰ",
    "rename": "",
    "quality": "ITEM_QUALITY_COMMON",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/StrengthenStoneMMO_A.webp",
    "description_en": "自选武器强化素材Ⅰ",
    "description_ru": "自选武器强化素材Ⅰ"
  },
  "42": {
    "id": "choose_StrengthenStoneMMO_B",
    "name": "Selecting Enhanced Resonance Module",
    "original": "自选强化共鸣模块",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Bag_StrengthenStoneMMO_B.webp",
    "description_en": "自选强化共鸣模块",
    "description_ru": "自选强化共鸣模块"
  },
  "43": {
    "id": "choose_StrengthenStoneMMO_B_Sup",
    "name": "Self-selected Enhanced Resonance Module (Agres)",
    "original": "自选强化共鸣模块(异能)",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Bag_StrengthenStoneMMO_B.webp",
    "description_en": "自选强化共鸣模块(异能)",
    "description_ru": "自选强化共鸣模块(异能)"
  },
  "44": {
    "id": "choose_StrengthenStoneMMO_B1B2",
    "name": "Selecting weapon enhancement material II",
    "original": "自选武器强化素材Ⅱ",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Bag_StrengthenStoneMMO_B.webp",
    "description_en": "自选武器强化素材Ⅱ",
    "description_ru": "自选武器强化素材Ⅱ"
  },
  "45": {
    "id": "choose_StrengthenStoneMMO_B2",
    "name": "Select Advanced Reconstructing Component",
    "original": "自选高级重构组件",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/choose_StrengthenStoneMMO_B2.webp",
    "description_en": "自选高级重构组件",
    "description_ru": "自选高级重构组件"
  },
  "46": {
    "id": "choose_StrengthenStoneMMO_B2_Sup",
    "name": "Selecting Advanced Reconstruct Component (Agregative)",
    "original": "自选高级重构组件(异能)",
    "rename": "",
    "quality": "ITEM_QUALITY_RARE",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Bag_StrengthenStoneMMO_B_2.webp",
    "description_en": "自选高级重构组件(异能)",
    "description_ru": "自选高级重构组件(异能)"
  },
  "47": {
    "id": "choose_StrengthenStoneMMO_C",
    "name": "Selecting Multidimensional Resonance Modules",
    "original": "自选多维共鸣模块",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Bag_StrengthenStoneMMO_C.webp",
    "description_en": "自选多维共鸣模块",
    "description_ru": "自选多维共鸣模块"
  },
  "48": {
    "id": "choose_StrengthenStoneMMO_C_Sup",
    "name": "Selecting Multi-Drey Resonance Module (Agres)",
    "original": "自选多维共鸣模块(异能)",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Bag_StrengthenStoneMMO_C.webp",
    "description_en": "自选多维共鸣模块(异能)",
    "description_ru": "自选多维共鸣模块(异能)"
  },
  "49": {
    "id": "choose_StrengthenStoneMMO_C1C2",
    "name": "Selecting weapon enhancement material III",
    "original": "自选武器强化素材Ⅲ",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Bag_StrengthenStoneMMO_C.webp",
    "description_en": "自选武器强化素材Ⅲ",
    "description_ru": "自选武器强化素材Ⅲ"
  },
  "50": {
    "id": "choose_StrengthenStoneMMO_C2",
    "name": "Selecting Super-Fine Reconstructed Component",
    "original": "自选超精重构组件",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/choose_StrengthenStoneMMO_C2.webp",
    "description_en": "自选超精重构组件",
    "description_ru": "自选超精重构组件"
  },
  "51": {
    "id": "choose_StrengthenStoneMMO_C2_Sup",
    "name": "Selecting super-precision reconstructed components (altitude)",
    "original": "自选超精重构组件(异能)",
    "rename": "",
    "quality": "ITEM_QUALITY_EPIC",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Bag_StrengthenStoneMMO_C_2.webp",
    "description_en": "自选超精重构组件(异能)",
    "description_ru": "自选超精重构组件(异能)"
  },
  "52": {
    "id": "choose_StrengthenStoneMMO_D",
    "name": "Selecting Ultra-River Resonance Module",
    "original": "自选超频共鸣模块",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Bag_StrengthenStoneMMO_D.webp",
    "description_en": "自选超频共鸣模块",
    "description_ru": "自选超频共鸣模块"
  },
  "53": {
    "id": "choose_StrengthenStoneMMO_D_Sup",
    "name": "Selecting Ultra-River Resonance Module (Agres)",
    "original": "自选超频共鸣模块(异能)",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Bag_StrengthenStoneMMO_D.webp",
    "description_en": "自选超频共鸣模块(异能)",
    "description_ru": "自选超频共鸣模块(异能)"
  },
  "54": {
    "id": "choose_StrengthenStoneMMO_D1D2",
    "name": "Selecting weapon enhancement material IV",
    "original": "自选武器强化素材Ⅳ",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Bag_StrengthenStoneMMO_D.webp",
    "description_en": "自选武器强化素材Ⅳ",
    "description_ru": "自选武器强化素材Ⅳ"
  },
  "55": {
    "id": "choose_StrengthenStoneMMO_D2",
    "name": "Select the absolute reconstruct component",
    "original": "自选绝对重构组件",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/choose_StrengthenStoneMMO_D2.webp",
    "description_en": "自选绝对重构组件",
    "description_ru": "自选绝对重构组件"
  },
  "56": {
    "id": "choose_StrengthenStoneMMO_D2_Sup",
    "name": "Selecting Absolute Reconstruct Component (Agnormal)",
    "original": "自选绝对重构组件(异能)",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/Bag_StrengthenStoneMMO_D_2.webp",
    "description_en": "自选绝对重构组件(异能)",
    "description_ru": "自选绝对重构组件(异能)"
  },
  "57": {
    "id": "choose_weapon_mmo1",
    "name": "Weapon Selection Box I",
    "original": "武器自选箱Ⅰ",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/gift_weapon_ssr.webp",
    "description_en": "Free choice weapon kit",
    "description_ru": "Комплект оружия на выбор"
  },
  "58": {
    "id": "choose_weapon_mmo2",
    "name": "Sign the weapon to your own choice.",
    "original": "签到武器自选Ⅰ",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/gift_weapon_ssr.webp",
    "description_en": "Free choice weapon kit",
    "description_ru": "Комплект оружия на выбор"
  },
  "59": {
    "id": "choose_weapon_mmo3",
    "name": "Sign Weapons Select II",
    "original": "签到武器自选Ⅱ",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/gift_weapon_ssr.webp",
    "description_en": "Free choice weapon kit",
    "description_ru": "Комплект оружия на выбор"
  },
  "60": {
    "id": "choose_weapon_mmo4",
    "name": "Sign Weapons Three",
    "original": "签到武器自选Ⅲ",
    "rename": "",
    "quality": "ITEM_QUALITY_LEGENDRY",
    "icon": "/datamine/shared/media/Hotta/Content/Resources/Icon/item/gift_weapon_ssr.webp",
    "description_en": "Free choice weapon kit",
    "description_ru": "Комплект оружия на выбор"
  }
};

export function mergeItemsData(
  serverPayload?: DatamineItemsDataset | null,
  mode: ItemsMode = 'gacha'
): ItemRow[] {
  // The server loader currently exposes the Gacha catalog as `items.json`.
  // Do not reuse that payload for MMO: it makes the mode switch look active
  // while rendering exactly the same rows in both modes.
  if (mode === 'gacha' && serverPayload && Object.keys(serverPayload).length > 0) {
    return normalizeItemRows(serverPayload);
  }

  const baseline = mode === 'mmo' ? BASELINE_MMO_ITEMS : BASELINE_GACHA_ITEMS;
  return normalizeItemRows(baseline);
}
