"use client";
import { translateUiText, type Locale } from '@tof-hub/i18n';
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { GUIDE_COPY, type GuideCopy } from "./guide-copy";
import { GuideExampleComparison, GuideCategoryBoard } from "./guide-examples";
import styles from "./guide.module.css";

function GuideBackLink({ label }: { label: string }) {
  return (
    <Link className={"guide-back-link"} href="/datamine/multype/">
      <svg
        width={"14"}
        height={"14"}
        viewBox={"0 0 24 24"}
        fill={"none"}
        stroke={"currentColor"}
        strokeWidth={"2.2"}
        strokeLinecap={"round"}
        strokeLinejoin={"round"}
        aria-hidden={"true"}
      >
        <line x1={"19"} y1={"12"} x2={"5"} y2={"12"}></line>
        <polyline points={"12 19 5 12 12 5"}></polyline>
      </svg>
      <span>{label}</span>
    </Link>
  );
}

const SECTION_IDS = ["overview", "renaming", "tables", "simplified", "disclaimer"] as const;
function GuideToc({ t, active }: { t: GuideCopy; active: string }) {
  const labels = [t.tocOverview, t.tocRenaming, t.tocTables, t.tocSimplified, t.tocDisclaimer];
  return (
    <>
      {SECTION_IDS.map((id, index) => (
        <a
          key={id}
          className={"guide-toc__link" + (active === id ? " guide-toc__link--active" : "")}
          aria-current={active === id ? "location" : undefined}
          href={"#" + id}
        >
          {labels[index]}
        </a>
      ))}
    </>
  );
}
export function MultypeGuideView({ initialLocale }: { initialLocale: Locale }) {
  const { locale } = useI18n();
  const t = GUIDE_COPY[locale === "ru" || locale === "en" ? locale : initialLocale];
  const [active, setActive] = useState<string>("overview");
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const top =
        (document.querySelector("[data-site-header]")?.getBoundingClientRect().bottom ?? 80) + 45;
      let current: string = "overview";
      for (const id of SECTION_IDS) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= top) current = id;
      }
      setActive(current);
    };
    const scroll = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          update();
        });
    };
    update();
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", scroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className={styles.root + " editorial-page multype-guide-layout"}>
      <div className={"guide-container"}>
        <article className={"guide-article"}>
          <header className={"guide-hero"} id={"overview"}>
            <div className={"guide-back-bar"}>
              <GuideBackLink label={t.backToTool} />
            </div>
            <p className={"guide-hero__eyebrow"}>{t.heroEyebrow}</p>
            <h1 className={"guide-hero__title"}>{t.heroTitle}</h1>
            <p className={"guide-hero__subtitle"}>{t.heroSubtitle}</p>
          </header>

          <nav className={"guide-inline-toc"} aria-label={t.tocTitle}>
            <span className={"guide-inline-toc__title"}>
              {t.tocTitle}
              {":"}
            </span>
            <div className={"guide-inline-toc__links"}>
              <GuideToc t={t} active={active} />
            </div>
          </nav>

          <section className={"guide-section"} id={"renaming"}>
            <div className={"guide-section__header"}>
              <h2 className={"guide-section__title"}>
                {t.secRenamingTitle}
                <a
                  className={"guide-anchor-link"}
                  href={"#renaming"}
                  aria-label={t.permalinkLabel + ": " + t.secRenamingTitle}
                >
                  {"#"}
                </a>
              </h2>
            </div>
            <div className={"guide-prose"}>
              <p>{t.renamingP1}</p>
              <p>{t.renamingP2}</p>
              <p>{t.renamingP3}</p>

              <div className={"guide-multype-showcase"} id={"multype-showcase"}>
                <div className={"guide-showcase-caption"}>
                  <span className={"guide-badge"}>{t.showcaseBadge}</span>
                </div>

                <GuideExampleComparison t={t} locale={locale} />

                <GuideCategoryBoard t={t} locale={locale} />
              </div>
            </div>
          </section>

          <section className={"guide-section"} id={"tables"}>
            <div className={"guide-section__header"}>
              <h2 className={"guide-section__title"}>
                {t.secTablesTitle}
                <a
                  className={"guide-anchor-link"}
                  href={"#tables"}
                  aria-label={t.permalinkLabel + ": " + t.secTablesTitle}
                >
                  {"#"}
                </a>
              </h2>
            </div>
            <div className={"guide-prose"}>
              <p>{t.tablesP1}</p>
              <p>{t.tablesP2}</p>
              <div className={"guide-example-box"}>
                <div className={"guide-example-box__header"}>
                  <span className={"guide-badge"}>{t.tablesExampleBadge}</span>
                  <strong>{t.tablesExampleTitle}</strong>
                  <code>{"Buff_HammerIce_SR_DamageUp_all10_ice2_OS.json"}</code>
                </div>
                <p style={{ marginBottom: "8px" }}>{t.tablesExampleDesc}</p>
                <div className={"guide-example-box__grid"}>
                  <div className={"guide-demo-col"}>
                    <span className={"guide-demo-col-badge guide-demo-col-badge--renamed"}>
                      {t.tablesExampleTable1Label}
                    </span>
                    <article className={"guide-multype-sub"}>
                      <div className={"guide-multype-sub__header"}>
                        <span className={"guide-multype-sub__name"}>{"IceAtkBeExtraUpMult"}</span>
                        <span className={"guide-multype-sub__meta"}>
                          {"1 "}
                          {t.subMetaFiles}
                        </span>
                      </div>
                      <div className={"guide-multype-sub__values"}>
                        <div className={"guide-multype-sub__pill guide-multype-sub__pill--renamed"}>
                          <div style={{ fontWeight: "700" }}>{"Ene A6 10%"}</div>
                          <div className={"guide-multype-sub__pill-meta"}>
                            {t.tablesExampleTable1Desc}
                          </div>
                        </div>
                      </div>
                    </article>
                  </div>

                  <div className={"guide-demo-arrow"}>
                    <span className={"guide-demo-arrow__icon"} style={{ fontSize: "26px" }}>
                      {"×"}
                    </span>
                    <span>{t.tablesMultipliedLabel}</span>
                  </div>

                  <div className={"guide-demo-col"}>
                    <span className={"guide-demo-col-badge guide-demo-col-badge--renamed"}>
                      {t.tablesExampleTable2Label}
                    </span>
                    <article className={"guide-multype-sub"}>
                      <div className={"guide-multype-sub__header"}>
                        <span className={"guide-multype-sub__name"}>
                          {"FinalDamageBeExtraUpMult"}
                        </span>
                        <span className={"guide-multype-sub__meta"}>
                          {"1 "}
                          {t.subMetaFiles}
                        </span>
                      </div>
                      <div className={"guide-multype-sub__values"}>
                        <div className={"guide-multype-sub__pill guide-multype-sub__pill--renamed"}>
                          <div style={{ fontWeight: "700" }}>{"Ene A6 10%"}</div>
                          <div className={"guide-multype-sub__pill-meta"}>
                            {t.tablesExampleTable2Desc}
                          </div>
                        </div>
                      </div>
                    </article>
                  </div>
                </div>
                <div className={"guide-example-formula"}>{t.tablesExampleFormula}</div>
              </div>
              <div className={"guide-bridge-box"}>
                <p className={"guide-bridge-box__text"}>{t.tablesBridgeText}</p>
              </div>
            </div>
          </section>

          <section className={"guide-section"} id={"simplified"}>
            <div className={"guide-section__header"}>
              <h2 className={"guide-section__title"}>
                {t.secSimplifiedTitle}
                <a
                  className={"guide-anchor-link"}
                  href={"#simplified"}
                  aria-label={t.permalinkLabel + ": " + t.secSimplifiedTitle}
                >
                  {"#"}
                </a>
              </h2>
            </div>
            <div className={"guide-prose"}>
              <p>{t.simplifiedIntro}</p>
              <div className={"guide-groups-grid"}>
                <div className={"guide-group-card guide-group-card--weapon-active"}>
                  <div className={"guide-group-card__header"}>
                    <h3 className={"guide-group-card__title"}>{t.groupWeaponActiveTitle}</h3>
                    <span className={"guide-group-card__tag"}>{t.groupWeaponActiveLabel}</span>
                  </div>
                  <p className={"guide-group-card__desc"}>{t.groupWeaponActiveDesc}</p>
                </div>
                <div className={"guide-group-card guide-group-card--weapon-passive"}>
                  <div className={"guide-group-card__header"}>
                    <h3 className={"guide-group-card__title"}>{t.groupWeaponPassiveTitle}</h3>
                    <span className={"guide-group-card__tag"}>{t.groupWeaponPassiveLabel}</span>
                  </div>
                  <p className={"guide-group-card__desc"}>{t.groupWeaponPassiveDesc}</p>
                </div>
                <div className={"guide-group-card guide-group-card--matrix"}>
                  <div className={"guide-group-card__header"}>
                    <h3 className={"guide-group-card__title"}>{t.groupMatrixTitle}</h3>
                    <span className={"guide-group-card__tag"}>{t.groupMatrixLabel}</span>
                  </div>
                  <p className={"guide-group-card__desc"}>{t.groupMatrixDesc}</p>
                </div>
                <div className={"guide-group-card guide-group-card--traits"}>
                  <div className={"guide-group-card__header"}>
                    <h3 className={"guide-group-card__title"}>{t.groupTraitsTitle}</h3>
                    <span className={"guide-group-card__tag"}>{t.groupTraitsLabel}</span>
                  </div>
                  <p className={"guide-group-card__desc"}>{t.groupTraitsDesc}</p>
                </div>
                <div className={"guide-group-card guide-group-card--relics"}>
                  <div className={"guide-group-card__header"}>
                    <h3 className={"guide-group-card__title"}>{t.groupRelicsTitle}</h3>
                    <span className={"guide-group-card__tag"}>{t.groupRelicsLabel}</span>
                  </div>
                  <p className={"guide-group-card__desc"}>{t.groupRelicsDesc}</p>
                </div>
                <div className={"guide-group-card guide-group-card--debuffs"}>
                  <div className={"guide-group-card__header"}>
                    <h3 className={"guide-group-card__title"}>{t.groupDebuffsTitle}</h3>
                    <span className={"guide-group-card__tag"}>{t.groupDebuffsLabel}</span>
                  </div>
                  <p className={"guide-group-card__desc"}>{t.groupDebuffsDesc}</p>
                </div>
              </div>
              <div className={"guide-rule-card guide-rule-card--highlight"}>
                <h3 className={"guide-rule-card__title"}>{t.simplifiedRuleNoCrossTitle}</h3>
                <div className={"guide-rule-card__desc"}>
                  <p>{t.simplifiedRuleNoCrossText}</p>
                  <div className={"guide-rule-template-tag"}>
                    <span className={"guide-rule-template-tag__badge"}>{t.templateRuleBadge}</span>
                    <strong className={"guide-rule-template-tag__text"}>
                      {t.templateRuleMatricesOnly}
                    </strong>
                  </div>
                </div>
              </div>
              <div className={"guide-rule-card"}>
                <h3 className={"guide-rule-card__title"}>{t.simplifiedRuleWeaponsTitle}</h3>
                <div className={"guide-rule-card__desc"}>
                  <p>{t.simplifiedRuleWeaponsText}</p>
                  <ul>
                    <li>{t.simplifiedRuleWeaponsActive}</li>
                    <li>{t.simplifiedRuleWeaponsPassive}</li>
                  </ul>
                </div>
              </div>
              <div className={"guide-rule-card"}>
                <h3 className={"guide-rule-card__title"}>{t.simplifiedRuleTraitsTitle}</h3>
                <div className={"guide-rule-card__desc"}>
                  <p>{t.simplifiedRuleTraitsText}</p>
                </div>
              </div>
              <div className={"guide-rule-card"}>
                <h3 className={"guide-rule-card__title"}>{t.simplifiedRuleRelicsTitle}</h3>
                <div className={"guide-rule-card__desc"}>
                  <p>{t.simplifiedRuleRelicsText}</p>
                </div>
              </div>

              <div className={"guide-rule-card guide-rule-card--exception"}>
                <h3 className={"guide-rule-card__title"}>{t.simplifiedExceptionTitle}</h3>
                <div className={"guide-rule-card__desc"}>
                  <p>{t.simplifiedExceptionText}</p>
                </div>
              </div>

              <div className={"guide-rule-card guide-rule-card--multipliers"}>
                <h3 className={"guide-rule-card__title"}>{t.simplifiedCrossMultiTitle}</h3>
                <div className={"guide-rule-card__desc"}>
                  {t.simplifiedCrossMultiText}
                  <div className={"guide-rule-formula-box"}>
                    <div className={"guide-rule-formula-main"}>{t.simplifiedCrossMultiFormulaMain}</div>
                    <div className={"guide-rule-formula-sub"}>
                      {t.simplifiedCrossMultiFormulaFinal}
                      <br />
                      {t.simplifiedCrossMultiFormulaElemental}
                    </div>
                  </div>
                  <div className={"guide-elemental-alert"}>
                    <div className={"guide-elemental-alert__header"}>
                      <svg
                        className={"guide-elemental-alert__icon"}
                        viewBox={"0 0 24 24"}
                        width={"18"}
                        height={"18"}
                        fill={"none"}
                        stroke={"currentColor"}
                        strokeWidth={"2"}
                        aria-hidden={"true"}
                      >
                        <circle cx={"12"} cy={"12"} r={"10"}></circle>
                        <line x1={"12"} y1={"8"} x2={"12"} y2={"12"}></line>
                        <line x1={"12"} y1={"16"} x2={"12.01"} y2={"16"}></line>
                      </svg>
                      <strong className={"guide-elemental-alert__title"}>
                        {t.simplifiedElementalAlertTitle}
                      </strong>
                    </div>
                    <p className={"guide-elemental-alert__text"}>{t.simplifiedElementalAlertP1}</p>
                    <p className={"guide-elemental-alert__text"}>{t.simplifiedElementalAlertP2}</p>
                  </div>
                </div>
              </div>

              <div className={"guide-table-wrap"}>
                <table className={"guide-table"}>
                  <caption>{t.tableBCaption}</caption>
                  <thead>
                    <tr>
                      <th scope={"col"}>{t.tableBColName}</th>
                      <th scope={"col"}>{t.tableBColCat}</th>
                      <th scope={"col"}>{t.tableBColKey}</th>
                      <th scope={"col"}>{t.tableBColRule}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div className={"guide-cell-stack"}>
                          <strong className={"guide-table-name"}>{translateUiText('Shiro A1 against enemy', locale)}</strong>
                          <span
                            className={"guide-pill guide-pill--module"}
                            style={{ width: "fit-content" }}
                          >
                            {t.tableBEnemyBadge}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={"guide-cell-stack"}>
                          <div className={"guide-chip-row"}>
                            <code>{"NoModule"}</code>
                            {" → "}
                            <span className={"guide-pill guide-pill--attr"}>{translateUiText('Phys debuff', locale)}</span>
                          </div>
                          <span className={"guide-cell-meta"}>
                            {"("}
                            <code>{"NoModule::PhyAtkBeExtraUpMult"}</code>
                            {")"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <code>{"Buff_DartsPhy_SSR_Level1_BeDamageUp.json"}</code>
                      </td>
                      <td>
                        <span className={"guide-table-note"}>{t.tableBRow1Rule}</span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div className={"guide-cell-stack"}>
                          <strong className={"guide-table-name"}>{translateUiText('Thalassic heart', locale)}</strong>
                          <span
                            className={"guide-pill guide-pill--attr"}
                            style={{ width: "fit-content" }}
                          >
                            {t.tableBDebuffBadge}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={"guide-cell-stack"}>
                          <div className={"guide-chip-row"}>
                            <code>{"NoModule"}</code>
                            {" → "}
                            <span className={"guide-pill guide-pill--attr"}>
                              {"FinalDamageBeExtraUpMult"}
                            </span>
                          </div>
                          <span className={"guide-cell-meta"}>{translateUiText('(Debuff bucket)', locale)}</span>
                        </div>
                      </td>
                      <td>
                        <div className={"guide-cell-stack"}>
                          <code>
                            {
                              "NoModule::FinalDamageBeExtraUpMult::Buff_FinBeDMGReduce_Artifact_SSR_018"
                            }
                          </code>
                          <span className={"guide-cell-meta"}>
                            {translateUiText('Also: ', locale)}
                            <code>{"Buff_FinBeDMGReduceLvl2_Artifact_SSR_018"}</code>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={"guide-table-note"}>{t.tableBRow2Rule}</span>
                      </td>
                    </tr>
                    <tr
                      style={{
                        backgroundImage: "none",
                        backgroundPositionX: "0%",
                        backgroundPositionY: "0%",
                        backgroundPosition: "0% 0%",
                        backgroundSize: "auto",
                        backgroundRepeat: "repeat",
                        backgroundOrigin: "padding-box",
                        backgroundClip: "border-box",
                        backgroundAttachment: "scroll",
                        backgroundColor: "rgba(245, 217, 122, 0.03)",
                        background: "rgba(245, 217, 122, 0.03)",
                      }}
                    >
                      <td>
                        <div className={"guide-cell-stack"}>
                          <strong className={"guide-table-name"}>{"Ene A6 10%"}</strong>
                          <span className={"guide-dual-badge"}>{t.tableBDualBadge}</span>
                        </div>
                      </td>
                      <td>
                        <div className={"guide-dual-table"}>
                          <div className={"guide-dual-table__item"}>
                            <span className={"guide-pill guide-pill--module"}>{"1"}</span>
                            <code>{"NoModule"}</code>
                            {" → "}
                            <span className={"guide-pill guide-pill--attr"}>{translateUiText('Frost debuff', locale)}</span>
                          </div>
                          <div className={"guide-dual-table__item"}>
                            <span className={"guide-pill guide-pill--module"}>{"2"}</span>
                            <code>{"NoModule"}</code>
                            {" → "}
                            <span className={"guide-pill guide-pill--attr"}>
                              {"FinalDamageBeExtraUpMult"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={"guide-dual-table"}>
                          <code>
                            {
                              "NoModule::IceAtkBeExtraUpMult::Buff_HammerIce_SR_DamageUp_all10_ice2_OS"
                            }
                          </code>
                          <code>
                            {
                              "NoModule::FinalDamageBeExtraUpMult::Buff_HammerIce_SR_DamageUp_all10_ice2_OS"
                            }
                          </code>
                        </div>
                      </td>
                      <td>
                        <span className={"guide-table-note"}>
                          <strong>{t.tableBRow3Rule}</strong>
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div className={"guide-cell-stack"}>
                          <strong className={"guide-table-name"}>{translateUiText('Spacetime rift', locale)}</strong>
                          <span
                            className={"guide-pill guide-pill--module"}
                            style={{ width: "fit-content" }}
                          >
                            {t.tableBRelicBadge}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={"guide-cell-stack"}>
                          <div className={"guide-chip-row"}>
                            <code>{"NoModule"}</code>
                            {" → "}
                            <span className={"guide-pill guide-pill--attr"}>
                              {"FinalDamageBeExtraUpMult"}
                            </span>
                          </div>
                          <span className={"guide-cell-meta"}>{translateUiText('(Relic field debuff)', locale)}</span>
                        </div>
                      </td>
                      <td>
                        <code>{"GE_ArtifactSSR005_BeAtkUp.json"}</code>
                      </td>
                      <td>
                        <span className={"guide-table-note"}>{t.tableBRow4Rule}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className={"guide-section"} id={"disclaimer"}>
            <div className={"guide-section__header"}>
              <h2 className={"guide-section__title"}>
                {t.secDisclaimerTitle}
                <a
                  className={"guide-anchor-link"}
                  href={"#disclaimer"}
                  aria-label={t.permalinkLabel + ": " + t.secDisclaimerTitle}
                >
                  {"#"}
                </a>
              </h2>
            </div>
            <div className={"guide-prose"}>
              <div className={"guide-disclaimer-alert"}>
                <p
                  style={{
                    marginTop: "0px",
                    marginRight: "0px",
                    marginBottom: "0px",
                    marginLeft: "0px",
                    margin: "0px",
                    fontSize: "14.5px",
                    lineHeight: "1.55",
                    color: "rgb(255, 230, 207)",
                  }}
                >
                  {t.disclaimerIntro}
                </p>
              </div>

              <h3
                style={{
                  marginTop: "26px",
                  marginRight: "0px",
                  marginBottom: "10px",
                  marginLeft: "0px",
                  margin: "26px 0px 10px",
                  color: "var(--dm-gold, #f5d97a)",
                  fontSize: "16px",
                }}
              >
                {t.disclaimerLanCardTitle}
              </h3>
              <p>{t.disclaimerLanDesc}</p>
              <div
                className={"guide-multype-board guide-multype-board--standalone"}
                style={{
                  marginTop: "16px",
                  marginRight: "auto",
                  marginBottom: "28px",
                  marginLeft: "auto",
                  margin: "16px auto 28px",
                  maxWidth: "540px",
                }}
              >
                <div
                  className={"guide-multype-board__header"}
                  style={{ borderTopColor: "rgb(59, 130, 246)" }}
                >
                  <div className={"guide-multype-board__title-wrap"}>
                    <span
                      className={"guide-multype-board__title"}
                      style={{ color: "rgb(96, 165, 250)" }}
                    >
                      {t.disclaimerLanCategoryName}
                    </span>
                    <span className={"guide-multype-board__sub"}>
                      {t.disclaimerLanCategoryMeta}
                    </span>
                  </div>
                </div>
                <div
                  className={"guide-multype-strip"}
                  style={{
                    paddingTop: "14px",
                    paddingRight: "14px",
                    paddingBottom: "14px",
                    paddingLeft: "14px",
                    padding: "14px",
                  }}
                >
                  <article
                    className={"guide-multype-sub"}
                    style={{ minWidth: "100%", width: "100%" }}
                  >
                    <div className={"guide-multype-sub__header"}>
                      <span className={"guide-multype-sub__name"}>{"FinalDamageExtraUpMult"}</span>
                      <span className={"guide-multype-sub__meta"}>{t.disclaimerLanColMeta}</span>
                    </div>
                    <div className={"guide-multype-sub__values"}>
                      <div
                        className={"guide-multype-sub__pill guide-multype-sub__pill--renamed"}
                        style={{
                          fontWeight: "700",
                          color: "rgb(180, 83, 9)",
                          backgroundImage: "none",
                          backgroundPositionX: "0%",
                          backgroundPositionY: "0%",
                          backgroundPosition: "0% 0%",
                          backgroundSize: "auto",
                          backgroundRepeat: "repeat",
                          backgroundOrigin: "padding-box",
                          backgroundClip: "border-box",
                          backgroundAttachment: "scroll",
                          backgroundColor: "rgb(254, 243, 199)",
                          background: "rgb(254, 243, 199)",
                        }}
                      >
                        {translateUiText('Lan Trait', locale)}
                      </div>
                      <div className={"guide-multype-sub__pill guide-multype-sub__pill--renamed"}>
                        {translateUiText('Asurada 4pc', locale)}
                      </div>
                      <div className={"guide-multype-sub__pill guide-multype-sub__pill--renamed"}>
                        {translateUiText('new Nemesis 4pc for using', locale)}
                      </div>
                      <div className={"guide-multype-sub__pill guide-multype-sub__pill--renamed"}>
                        {translateUiText('Alyss 4pc', locale)}
                      </div>
                      <div className={"guide-multype-sub__pill guide-multype-sub__pill--renamed"}>
                        {translateUiText('Saki 4pc', locale)}
                      </div>
                    </div>
                  </article>
                </div>
              </div>

              <h3
                style={{
                  marginTop: "28px",
                  marginRight: "0px",
                  marginBottom: "10px",
                  marginLeft: "0px",
                  margin: "28px 0px 10px",
                  color: "var(--dm-gold, #f5d97a)",
                  fontSize: "16px",
                }}
              >
                {t.disclaimerBeCardTitle}
              </h3>
              <p>{t.disclaimerBeDesc}</p>
              <div
                className={"guide-multype-board"}
                style={{
                  marginTop: "16px",
                  marginRight: "auto",
                  marginBottom: "28px",
                  marginLeft: "auto",
                  margin: "16px auto 28px",
                  maxWidth: "680px",
                }}
              >
                <div
                  className={"guide-multype-board__header"}
                  style={{ borderTopColor: "rgb(236, 72, 153)" }}
                >
                  <div className={"guide-multype-board__title-wrap"}>
                    <span
                      className={"guide-multype-board__title"}
                      style={{ color: "rgb(244, 114, 182)" }}
                    >
                      {t.disclaimerBeCategoryName}
                    </span>
                  </div>
                </div>
                <div
                  className={"guide-multype-strip"}
                  style={{
                    paddingTop: "14px",
                    paddingRight: "14px",
                    paddingBottom: "14px",
                    paddingLeft: "14px",
                    padding: "14px",
                    display: "flex",
                    gap: "14px",
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  <article
                    className={"guide-multype-sub"}
                    style={{
                      flexGrow: "1",
                      flexShrink: "1",
                      flexBasis: "0%",
                      flex: "1 1 0%",
                      minWidth: "250px",
                    }}
                  >
                    <div
                      className={"guide-multype-sub__header"}
                      style={{
                        backgroundImage: "none",
                        backgroundPositionX: "0%",
                        backgroundPositionY: "0%",
                        backgroundPosition: "0% 0%",
                        backgroundSize: "auto",
                        backgroundRepeat: "repeat",
                        backgroundOrigin: "padding-box",
                        backgroundClip: "border-box",
                        backgroundAttachment: "scroll",
                        backgroundColor: "rgb(238, 221, 238)",
                        background: "rgb(238, 221, 238)",
                      }}
                    >
                      <span
                        className={"guide-multype-sub__name"}
                        style={{ color: "rgb(107, 33, 168)" }}
                      >
                        {t.disclaimerBeCol1Name}
                      </span>
                      <span className={"guide-multype-sub__meta"}>{t.disclaimerBeCol1Meta}</span>
                    </div>
                    <div className={"guide-multype-sub__values"}>
                      <div
                        className={"guide-multype-sub__pill"}
                        style={{ fontSize: "11px", wordBreak: "break-all" }}
                      >
                        {"Buff_AyanamiRei_TraceArrow_Bleed_BeDamageUp_Level3"}
                      </div>
                      <div
                        className={"guide-multype-sub__pill"}
                        style={{ fontSize: "11px", wordBreak: "break-all" }}
                      >
                        {"Buff_HammerThu_SSR_Level5_1"}
                      </div>
                    </div>
                  </article>

                  <article
                    className={"guide-multype-sub"}
                    style={{
                      flexGrow: "1",
                      flexShrink: "1",
                      flexBasis: "0%",
                      flex: "1 1 0%",
                      minWidth: "250px",
                    }}
                  >
                    <div
                      className={"guide-multype-sub__header"}
                      style={{
                        backgroundImage: "none",
                        backgroundPositionX: "0%",
                        backgroundPositionY: "0%",
                        backgroundPosition: "0% 0%",
                        backgroundSize: "auto",
                        backgroundRepeat: "repeat",
                        backgroundOrigin: "padding-box",
                        backgroundClip: "border-box",
                        backgroundAttachment: "scroll",
                        backgroundColor: "rgb(238, 221, 238)",
                        background: "rgb(238, 221, 238)",
                      }}
                    >
                      <span
                        className={"guide-multype-sub__name"}
                        style={{ color: "rgb(107, 33, 168)" }}
                      >
                        {t.disclaimerBeCol2Name}
                      </span>
                      <span className={"guide-multype-sub__meta"}>{t.disclaimerBeCol2Meta}</span>
                    </div>
                    <div className={"guide-multype-sub__values"}>
                      <div
                        className={"guide-multype-sub__pill"}
                        style={{ fontSize: "11px", wordBreak: "break-all" }}
                      >
                        {"Actor_GE_Buff_StavesIce_SSR_Level6_2_OS"}
                      </div>
                      <div
                        className={"guide-multype-sub__pill"}
                        style={{ fontSize: "11px", wordBreak: "break-all" }}
                      >
                        {"Buff_Antoria_WingsEnergeticState"}
                      </div>
                      <div
                        className={"guide-multype-sub__pill"}
                        style={{ fontSize: "11px", wordBreak: "break-all" }}
                      >
                        {"Buff_BlackStar_Electric_Major"}
                      </div>
                      <div
                        className={"guide-multype-sub__pill"}
                        style={{ fontSize: "11px", wordBreak: "break-all" }}
                      >
                        {"Buff_BlackStar_Level6_DMGUp"}
                      </div>
                      <div
                        className={"guide-multype-sub__pill"}
                        style={{ fontSize: "11px", wordBreak: "break-all" }}
                      >
                        {"Buff_Blevi_Skill_Enhance"}
                      </div>
                    </div>
                  </article>
                </div>
              </div>
              <div
                className={"guide-rule-card guide-rule-card--highlight"}
                style={{ marginTop: "24px" }}
              >
                <p
                  style={{
                    marginTop: "0px",
                    marginRight: "0px",
                    marginBottom: "0px",
                    marginLeft: "0px",
                    margin: "0px",
                    fontSize: "14.5px",
                    lineHeight: "1.55",
                  }}
                >
                  {t.disclaimerConclusion}
                </p>
              </div>
            </div>
          </section>
          <div
            className={"guide-back-bar"}
            style={{
              marginTop: "36px",
              paddingTop: "24px",
              borderTop: "1px solid var(--dm-border, rgba(255, 255, 255, 0.08))",
            }}
          >
            <GuideBackLink label={t.backToTool} />
          </div>
        </article>

        <aside className={"guide-sidebar"} aria-label={t.tocTitle}>
          <nav className={"guide-toc"}>
            <span className={"guide-toc__title"}>{t.tocTitle}</span>
            <div className={"guide-toc__links"}>
              <GuideToc t={t} active={active} />
            </div>
          </nav>
        </aside>
      </div>
    </div>
  );
}
