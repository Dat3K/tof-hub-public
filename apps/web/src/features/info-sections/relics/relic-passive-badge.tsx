import { GameBadge } from "@tof-hub/ui";
import { gameAsset } from "@tof-hub/game-assets";
import type { RelicPassiveStat } from "./types";
import resistanceIcons from '../../../../public/game-data/relic-resistance-icons.json';

const ICON_SUFFIX = { phys: "wu", flame: "huo", frost: "bing", volt: "lei", altered: "powers" };
/** Element names of the shared resistance tint (styles/resistance-icons.css). */
const RESISTANCE_ELEMENT = { phys: "Physical", flame: "Flame", frost: "Frost", volt: "Volt", altered: "Altered" } as const;

const NEUTRAL_ICON_PATH: Partial<Record<"hp" | "crit", string>> = {
  hp: "/datamine/shared/assets/icons/stat_hp.svg",
  crit: "/datamine/shared/assets/icons/stat_crit.webp",
};

export function RelicPassiveBadge({
  stat,
  isRu,
  isMmo = false,
  presentation = "label",
  className,
}: {
  stat: RelicPassiveStat;
  isRu: boolean;
  isMmo?: boolean;
  presentation?: "icon" | "label";
  className?: string;
}) {
  const label = isRu ? stat.label_ru : stat.label_en;
  const resistance = stat.type === "def" && stat.element !== "neutral" ? RESISTANCE_ELEMENT[stat.element] : undefined;
  const iconPath = isMmo && stat.type === "hp"
    ? gameAsset("Hotta/Content/Resources/UI/AttributeIcon/icon_hp.webp")
    :
    (stat.type === "def" && stat.element !== "neutral" ? resistanceIcons[stat.element] : undefined) ||
    stat.iconPath ||
    (stat.element === "neutral"
      ? NEUTRAL_ICON_PATH[stat.type === "hp" || stat.type === "crit" ? stat.type : "hp"]
      : gameAsset(`Hotta/Content/Resources/UI/wuqi/icon_element_${ICON_SUFFIX[stat.element]}`));

  return (
    <GameBadge
      variant={stat.element === "neutral" ? "default" : stat.element}
      presentation={presentation}
      title={label}
      data-passive-type={stat.type}
      data-mmo={isMmo || undefined}
      className={className}
      icon={
        <img src={iconPath || ""} alt="" className={resistance ? "resistance-icon" : undefined} data-resistance-element={resistance} />
      }
    >
      {label}
    </GameBadge>
  );
}
