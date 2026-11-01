import { GameBadge } from "@tof-hub/ui";
import { translateUiText, type Locale } from "@tof-hub/i18n";
import type { PropertyVariant } from "@tof-hub/ui";

export function getRelicPropertyVariant(property?: string): PropertyVariant {
  switch ((property || "").toLowerCase()) {
    case "attack":
      return "attack";
    case "defense":
      return "defense";
    case "assist":
      return "assist";
    case "function":
      return "function";
    case "survive":
      return "survive";
    default:
      return "attack";
  }
}

export function RelicPropertyBadge({
  property,
  locale,
  className,
}: {
  property?: string;
  locale: Locale;
  className?: string;
}) {
  const variant = getRelicPropertyVariant(property);
  const label = translateUiText(property || "Attack", locale);

  return (
    <GameBadge
      variant={variant}
      size="sm"
      className={className}
      icon={
        <img
          src={`/datamine/shared/assets/icons/relics/type_${variant}.webp`}
          alt=""
        />
      }
    >
      {label}
    </GameBadge>
  );
}
