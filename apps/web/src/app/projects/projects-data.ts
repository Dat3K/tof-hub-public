import { GITHUB_REPO_URL } from "@/lib/project-links";

export interface ProjectResource {
  name: string;
  url: string;
  displayUrl: string;
  type: string;
  description: {
    en: string;
    ru: string;
  };
}

export interface ProjectCategory {
  id: string;
  title: {
    en: string;
    ru: string;
  };
  color: string;
  resources: ProjectResource[];
}

export const PROJECTS_DATA: ProjectCategory[] = [
  {
    id: "wikis",
    title: {
      en: "Wikis & databases",
      ru: "Вики и базы данных"
    },
    color: "#c084fc",
    resources: [
      {
        name: "Tower of Fantasy Index",
        url: "https://www.toweroffantasy.info/",
        displayUrl: "toweroffantasy.info",
        type: "Web",
        description: {
          en: "Structured game database covering Simulacra, weapons, matrices, relics, cosmetics, and food.",
          ru: "Структурированная база данных по симулякрам, оружию, матрицам, реликвиям, косметике и рецептам."
        }
      },
      {
        name: "Tower of Fantasy Wiki",
        url: "https://toweroffantasy.fandom.com/wiki/Tower_of_Fantasy_Wiki",
        displayUrl: "toweroffantasy.fandom.com",
        type: "Wiki",
        description: {
          en: "Community-maintained English wiki covering characters, weapons, systems, story and other Tower of Fantasy information.",
          ru: "Англоязычная вики сообщества по персонажам, оружию, игровым системам и сюжету Tower of Fantasy."
        }
      },
      {
        name: "Tower of Fantasy Interactive Map",
        url: "https://tower-of-fantasy-map.hotgames.gg/",
        displayUrl: "tower-of-fantasy-map.hotgames.gg",
        type: "Tool",
        description: {
          en: "Dedicated interactive map resource with exploration markers, chests, puzzles, and collectible locations.",
          ru: "Интерактивная карта мира с точками исследования, сундуками, загадками и расположением ресурсов."
        }
      }
    ]
  },
  {
    id: "calculators",
    title: {
      en: "Tools & calculators",
      ru: "Инструменты и калькуляторы"
    },
    color: "#ff6b8b",
    resources: [
      {
        name: "Tower of Fantasy Tools",
        url: "https://www.toweroffantasytools.com/",
        displayUrl: "toweroffantasytools.com",
        type: "Tool",
        description: {
          en: "Gear comparison, build presets, team damage calculators, and reference tools for weapons and matrices.",
          ru: "Инструменты для сравнения экипировки, пресетов билдов, калькуляторов урона команд и справочников."
        }
      },
      {
        name: "Maygi's Team DPS",
        url: "https://docs.google.com/spreadsheets/d/1ZrJokNh_0AF_9welc7Etz6K8jlpzi5bXpiWz-mQZa78/edit#gid=1482052592",
        displayUrl: "docs.google.com/.../Maygi Team DPS",
        type: "Sheet",
        description: {
          en: "Maygi's team DPS spreadsheet for game versions up to 3.0, with useful damage formulas and calculations.",
          ru: "Таблица командного DPS от Maygi для версий игры до 3.0 с полезными формулами и расчётами урона."
        }
      },
      {
        name: "ToF WARP Toolbox (幻塔WARPお道具箱)",
        url: "https://tof-warp-odougubako.site/",
        displayUrl: "tof-warp-odougubako.site",
        type: "Tool",
        description: {
          en: "Japanese community toolbox featuring an item database, gear references, and practical gameplay utility tools.",
          ru: "Японский инструментарий сообщества с базой предметов, справочниками экипировки и полезными утилитами."
        }
      }
    ]
  },
  {
    id: "author",
    title: {
      en: "By the ToF Hub author",
      ru: "От автора ToF Hub"
    },
    color: "#f5d97a",
    resources: [
      {
        name: "ToF Hub",
        url: GITHUB_REPO_URL,
        displayUrl: "github.com/smilekritik/tof-hub-public",
        type: "Code",
        description: {
          en: "Source code of this site and its game-data exporter. Build your own copy from the game version you have installed.",
          ru: "Исходный код этого сайта и экспортёра игровых данных. Соберите свою копию из установленной у вас версии игры."
        }
      },
      {
        name: "Everything",
        url: "https://docs.google.com/spreadsheets/d/1RExuEj6DGWgaYnN2lmYjbEO-ip-KzwHyNfGK_0M8Uro",
        displayUrl: "docs.google.com/.../Everything",
        type: "Sheet",
        description: {
          en: "Collection of Tower of Fantasy datamined tables, reference sheets and combat calculators.",
          ru: "Коллекция датамайн-таблиц, справочных материалов и боевых калькуляторов по Tower of Fantasy."
        }
      },
      {
        name: "Tower of Fantasy Exporter Scanner",
        url: "https://github.com/smilekritik/Tower-of-fantasy-exporter-scanner",
        displayUrl: "github.com/smilekritik/Tower-of-fantasy-exporter-scanner",
        type: "Tool",
        description: {
          en: "Asset export and scanning CLI tools used for deep game research and modifier analysis.",
          ru: "Инструменты для экспорта и сканирования ассетов для глубоких исследований и анализа модификаторов."
        }
      }
    ]
  },
  {
    id: "official",
    title: {
      en: "Official channels",
      ru: "Официальные каналы"
    },
    color: "#7dd3fc",
    resources: [
      {
        name: "Tower of Fantasy — X",
        url: "https://x.com/ToF_EN_Official",
        displayUrl: "x.com/ToF_EN_Official",
        type: "Social",
        description: {
          en: "Official Tower of Fantasy announcements in English: updates, events and maintenance.",
          ru: "Официальные анонсы Tower of Fantasy на английском: обновления, события и техработы."
        }
      },
      {
        name: "r/TowerofFantasy",
        url: "https://www.reddit.com/r/TowerofFantasy/",
        displayUrl: "reddit.com/r/TowerofFantasy",
        type: "Community",
        description: {
          en: "The official Tower of Fantasy community on Reddit: news, guides and player discussions.",
          ru: "Официальное сообщество Tower of Fantasy на Reddit: новости, гайды и обсуждения игроков."
        }
      },
      {
        name: "Tower of Fantasy — Bilibili",
        url: "https://space.bilibili.com/586631367",
        displayUrl: "space.bilibili.com/586631367",
        type: "Video",
        description: {
          en: "Official Tower of Fantasy announcements and videos on Bilibili.",
          ru: "Официальные анонсы Tower of Fantasy и видео на Bilibili."
        }
      }
    ]
  }
];
