import { useState } from "react";
import { translateUiText, type Locale } from '@tof-hub/i18n';
import type { GuideCopy } from "./guide-copy";
export function GuideExampleComparison({ t, locale }: { t: GuideCopy; locale: Locale }) {
  const [selected, setSelected] = useState<"asuka" | "relic" | "couant">("asuka");
  // Worked examples are preserved editorial illustrations, not a live game dataset.
  const siteLabel = (value: string) => translateUiText(value, locale);
  const examples = {
    asuka: { name: "FinalDamageExtraUpMult", datamined: "Buff_Matrix_SSR88", renamed: siteLabel("Asuka 4pc") },
    relic: {
      name: "FinalDamageExtraUpMult",
      datamined: "Buff_FinDMGUp_Artifact_SSR_025",
      renamed: siteLabel("Battle eye"),
    },
    couant: { name: siteLabel("Normal"), datamined: "Buff_Artifact_SSR012_DamageUp", renamed: siteLabel("Type Count") },
  };
  const example = examples[selected];
  return (
    <>
      <div className={"guide-example-selector"} role={"group"} aria-label={t.exampleSelectorAria}>
        <span className={"guide-example-selector__label"}>
          {t.exampleSelectorLabel}
          {":"}
        </span>
        <div className={"guide-example-selector__buttons"}>
          <button
            type={"button"}
            className={"guide-example-btn" + (selected === "asuka" ? " is-active" : "")}
            onClick={() => setSelected("asuka")}
            aria-pressed={selected === "asuka"}
            data-example-key={"asuka"}
          >
            {examples.asuka.name} ({examples.asuka.renamed})
          </button>
          <button
            type={"button"}
            className={"guide-example-btn" + (selected === "relic" ? " is-active" : "")}
            onClick={() => setSelected("relic")}
            aria-pressed={selected === "relic"}
            data-example-key={"relic"}
          >
            {examples.relic.name} ({examples.relic.renamed})
          </button>
          <button
            type={"button"}
            className={"guide-example-btn" + (selected === "couant" ? " is-active" : "")}
            onClick={() => setSelected("couant")}
            aria-pressed={selected === "couant"}
            data-example-key={"couant"}
          >
            {"\n                      "}{t.exampleTypeCountLabel}{"\n                    "}
          </button>
        </div>
      </div>
      <div className={"guide-demo-pair"} data-guide-demo-pair={""}>
        <div className={"guide-demo-col"}>
          <span className={"guide-demo-col-badge guide-demo-col-badge--datamined"}>
            {t.comparisonDataminedBadge}
          </span>
          <article className={"guide-multype-sub"}>
            <div className={"guide-multype-sub__header"}>
              <span className={"guide-multype-sub__name"} data-pair-sub-name={""}>
                {example.name}
              </span>
              <span className={"guide-multype-sub__meta"} data-pair-sub-meta={""}>
                {1} {t.subMetaFiles}
              </span>
            </div>
            <div className={"guide-multype-sub__values"} data-pair-datamined-values={""}>
              <div className="guide-multype-sub__pill">{example.datamined}</div>
            </div>
          </article>
        </div>

        <div className={"guide-demo-arrow"}>
          <span className={"guide-demo-arrow__icon"} aria-hidden={"true"}>
            {"→"}
          </span>
          <span>{t.comparisonArrowText}</span>
        </div>

        <div className={"guide-demo-col"}>
          <span className={"guide-demo-col-badge guide-demo-col-badge--renamed"}>
            {t.comparisonRenamedBadge}
          </span>
          <article className={"guide-multype-sub"}>
            <div className={"guide-multype-sub__header"}>
              <span className={"guide-multype-sub__name"} data-pair-sub-name-renamed={""}>
                {example.name}
              </span>
              <span className={"guide-multype-sub__meta"} data-pair-sub-meta-renamed={""}>
                {1} {t.subMetaFiles}
              </span>
            </div>
            <div className={"guide-multype-sub__values"} data-pair-renamed-values={""}>
              <div className="guide-multype-sub__pill guide-multype-sub__pill--renamed">
                {example.renamed}
              </div>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
export function GuideCategoryBoard({ t, locale }: { t: GuideCopy; locale: Locale }) {
  const [mode, setMode] = useState<"renamed" | "datamined">("renamed");
  const siteLabel = (value: string) => translateUiText(value, locale);
  return (
    <div className={"guide-multype-board multype-main"}>
      <div className={"guide-multype-board__header"}>
        <div className={"guide-multype-board__title-wrap"}>
          <h4 className={"guide-multype-board__title"}>{t.showcaseBadge}</h4>
          <span className={"guide-multype-board__meta"}>{t.boardCategoryMeta}</span>
        </div>

        <div className={"guide-board-toggle"} role={"group"} aria-label={t.boardToggleAria}>
          <button
            type={"button"}
            className={"guide-board-toggle__btn" + (mode === "renamed" ? " is-active" : "")}
            onClick={() => setMode("renamed")}
            aria-pressed={mode === "renamed"}
            data-guide-board-mode={"renamed"}
          >
            {t.boardBtnRenamed}
          </button>
          <button
            type={"button"}
            className={"guide-board-toggle__btn" + (mode === "datamined" ? " is-active" : "")}
            onClick={() => setMode("datamined")}
            aria-pressed={mode === "datamined"}
            data-guide-board-mode={"datamined"}
          >
            {t.boardBtnDatamined}
          </button>
        </div>
      </div>
      <div className={"guide-multype-strip dm-scrollbar"} data-guide-board-strip={""}>
        <section className={"guide-multype-group-col"}>
          <div
            className={"guide-multype-group-col__header"}
            style={{ borderTopColor: "rgb(245, 217, 122)" }}
          >
            <h4
              className={"guide-multype-group-col__title"}
              data-category-renamed={"Relics"}
              data-category-datamined={"ModuleExtraType_CardPassive"}
            >
              {mode === "datamined" ? "ModuleExtraType_CardPassive" : siteLabel("Relics")}
            </h4>
            <span className={"guide-multype-group-col__meta"}>
              {"1 "}
              {t.subMetaCol}
            </span>
          </div>
          <div className={"guide-multype-group-col__body"}>
            <article className={"guide-multype-sub"}>
              <div className={"guide-multype-sub__header"}>
                <span className={"guide-multype-sub__name"}>{"FinalDamageExtraUpMult"}</span>
                <span className={"guide-multype-sub__meta"}>
                  {"1 "}
                  {t.subMetaFiles}
                </span>
              </div>
              <div className={"guide-multype-sub__values"}>
                <div
                  className={
                    "guide-multype-sub__pill" +
                    (mode === "renamed" ? " guide-multype-sub__pill--renamed" : "")
                  }
                  data-renamed={"Battle eye"}
                  data-datamined={"Buff_FinDMGUp_Artifact_SSR_025"}
                >
                  {mode === "datamined" ? "Buff_FinDMGUp_Artifact_SSR_025" : siteLabel("Battle eye")}
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className={"guide-multype-group-col"}>
          <div
            className={"guide-multype-group-col__header"}
            style={{ borderTopColor: "rgb(192, 132, 252)" }}
          >
            <h4
              className={"guide-multype-group-col__title"}
              data-category-renamed={"Matrix"}
              data-category-datamined={"ModuleExtraType_Talent"}
            >
              {mode === "datamined" ? "ModuleExtraType_Talent" : siteLabel("Matrix")}
            </h4>
            <span className={"guide-multype-group-col__meta"}>
              {"1 "}
              {t.subMetaCol}
            </span>
          </div>
          <div className={"guide-multype-group-col__body"}>
            <article className={"guide-multype-sub"}>
              <div className={"guide-multype-sub__header"}>
                <span className={"guide-multype-sub__name"}>{"FinalDamageExtraUpMult"}</span>
                <span className={"guide-multype-sub__meta"}>
                  {"1 "}
                  {t.subMetaFiles}
                </span>
              </div>
              <div className={"guide-multype-sub__values"}>
                <div
                  className={
                    "guide-multype-sub__pill" +
                    (mode === "renamed" ? " guide-multype-sub__pill--renamed" : "")
                  }
                  data-renamed={"Asuka 4pc"}
                  data-datamined={"Buff_Matrix_SSR88"}
                >
                  {mode === "datamined" ? "Buff_Matrix_SSR88" : siteLabel("Asuka 4pc")}
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className={"guide-multype-group-col"}>
          <div
            className={"guide-multype-group-col__header"}
            style={{ borderTopColor: "rgb(16, 185, 129)" }}
          >
            <h4
              className={"guide-multype-group-col__title"}
              data-category-renamed={"Traits"}
              data-category-datamined={"ModuleExtraType_Pet"}
            >
              {mode === "datamined" ? "ModuleExtraType_Pet" : siteLabel("Traits")}
            </h4>
            <span className={"guide-multype-group-col__meta"}>
              {"1 "}
              {t.subMetaCol}
            </span>
          </div>
          <div className={"guide-multype-group-col__body"}>
            <article className={"guide-multype-sub"}>
              <div className={"guide-multype-sub__header"}>
                <span className={"guide-multype-sub__name"}>{"FinalDamageExtraUpMult"}</span>
                <span className={"guide-multype-sub__meta"}>
                  {"1 "}
                  {t.subMetaFiles}
                </span>
              </div>
              <div className={"guide-multype-sub__values"}>
                <div
                  className={
                    "guide-multype-sub__pill" +
                    (mode === "renamed" ? " guide-multype-sub__pill--renamed" : "")
                  }
                  data-renamed={"Zeke trait"}
                  data-datamined={"Buff_Zeke"}
                >
                  {mode === "datamined" ? "Buff_Zeke" : siteLabel("Zeke trait")}
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className={"guide-multype-group-col"}>
          <div
            className={"guide-multype-group-col__header"}
            style={{ borderTopColor: "rgb(196, 139, 77)" }}
          >
            <h4
              className={"guide-multype-group-col__title"}
              data-category-renamed={'Weapon "passive"'}
              data-category-datamined={"ModuleExtraType_WeaponPassive"}
            >
              {mode === "datamined" ? "ModuleExtraType_WeaponPassive" : siteLabel('Weapon "passive"')}
            </h4>
            <span className={"guide-multype-group-col__meta"}>
              {"1 "}
              {t.subMetaCol}
            </span>
          </div>
          <div className={"guide-multype-group-col__body"}>
            <article className={"guide-multype-sub"}>
              <div className={"guide-multype-sub__header"}>
                <span className={"guide-multype-sub__name"}>{"FireAtkExtraUpMult"}</span>
                <span className={"guide-multype-sub__meta"}>
                  {"1 "}
                  {t.subMetaFiles}
                </span>
              </div>
              <div className={"guide-multype-sub__values"}>
                <div
                  className={
                    "guide-multype-sub__pill" +
                    (mode === "renamed" ? " guide-multype-sub__pill--renamed" : "")
                  }
                  data-renamed={"Zero orbs A5"}
                  data-datamined={"Buff_CubeFire_SSR_Level4Dam_OS"}
                >
                  {mode === "datamined" ? "Buff_CubeFire_SSR_Level4Dam_OS" : siteLabel("Zero orbs A5")}
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className={"guide-multype-group-col"}>
          <div
            className={"guide-multype-group-col__header"}
            style={{ borderTopColor: "rgb(224, 36, 36)" }}
          >
            <h4
              className={"guide-multype-group-col__title"}
              data-category-renamed={"No cathegory"}
              data-category-datamined={"NoModule"}
            >
              {mode === "datamined" ? "NoModule" : siteLabel("No category")}
            </h4>
            <span className={"guide-multype-group-col__meta"}>
              {"1 "}
              {t.subMetaCol}
            </span>
          </div>
          <div className={"guide-multype-group-col__body"}>
            <article className={"guide-multype-sub"}>
              <div className={"guide-multype-sub__header"}>
                <span
                  className={"guide-multype-sub__name"}
                  data-sub-renamed={"Normal"}
                  data-sub-datamined={"FinalDamageExtraUpMult"}
                >
                  {mode === "datamined" ? "FinalDamageExtraUpMult" : siteLabel("Normal")}
                </span>
                <span className={"guide-multype-sub__meta"}>
                  {"1 "}
                  {t.subMetaFiles}
                </span>
              </div>
              <div className={"guide-multype-sub__values"}>
                <div
                  className={
                    "guide-multype-sub__pill" +
                    (mode === "renamed" ? " guide-multype-sub__pill--renamed" : "")
                  }
                  data-renamed={"Type Count"}
                  data-datamined={"Buff_Artifact_SSR012_DamageUp"}
                >
                  {mode === "datamined" ? "Buff_Artifact_SSR012_DamageUp" : siteLabel("Type Count")}
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
