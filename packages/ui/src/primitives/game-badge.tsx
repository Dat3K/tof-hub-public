import React from "react";
import { Badge } from "./badge";
import type { BadgeProps, ElementVariant } from "./types";

export interface GameBadgeProps extends BadgeProps {
  presentation?: "icon" | "label";
  secondaryElement?: ElementVariant;
}

/** Reference Info badge; keep accessible text even in the compact icon variant. */
export function GameBadge({
  presentation = "label",
  secondaryElement,
  children,
  ...props
}: GameBadgeProps) {
  const variant = props.variant === "physical" ? "phys" : props.variant;
  return (
    <Badge
      {...props}
      variant={variant}
      data-variant={variant}
      data-secondary-element={secondaryElement === "physical" ? "phys" : secondaryElement}
      data-presentation={props.icon ? presentation : "label"}
    >
      <span className="tof-badge-label">{children}</span>
    </Badge>
  );
}
