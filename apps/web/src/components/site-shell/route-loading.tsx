"use client";

import { usePathname } from "next/navigation";
import { LoadingState } from "@tof-hub/ui";
import { useI18n } from "@/lib/i18n";

export function RouteLoading() {
  const pathname = usePathname();
  const { t } = useI18n();
  const section = pathname?.split("/").filter(Boolean).at(-1) || "";
  const label = t(`common.routeSections.${section}`, {
    defaultValue: t("common.routeSectionFallback"),
  });
  return (
    <LoadingState
      fullPage
      message={t("common.routeLoading", { section: label })}
    />
  );
}
