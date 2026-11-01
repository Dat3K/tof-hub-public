import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { GameRichText } from "./game-rich-text";
import { GameBadge } from "./game-badge";
import { LoadingState } from "./loading-state";

describe("Shared game presentation", () => {
  it("escapes untrusted markup and preserves punctuation and decoded entities", () => {
    const { container } = render(
      <GameRichText
        text={
          'Rosebud\'s &amp; <img src=x onerror=alert(1)> <a href="javascript:alert(1)">unsafe</a>'
        }
      />,
    );
    expect(container.querySelector("img,script,a")).toBeNull();
    expect(container.textContent).toContain("Rosebud's & <img src=x onerror=alert(1)> unsafe");
  });
  it("emphasizes the selected rank and safely links known names", () => {
    const { container, rerender } = render(
      <GameRichText
        text="Rosebud: 28%/30%/32%/34%"
        rank={1}
        links={[{ label: "Rosebud", href: "/info/simulacra/?char=zoey" }]}
      />,
    );
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/info/simulacra/?char=zoey");
    expect(container.querySelector(".sim-num-hl")?.textContent).toBe("30%");
    rerender(<GameRichText text="28%/30%/32%/34%" />);
    expect(container.querySelector(".sim-num-hl")?.textContent).toBe("34%");
  });
  it("highlights game keyword tags without showing the markup", () => {
    const { container } = render(<GameRichText text="Increases <wenzi>physical ATK</> by<shuzhi> 150</>" />);
    expect(container.textContent).toBe("Increases physical ATK by 150");
    expect(container.querySelector(".sim-keyword-hl")?.textContent).toBe("physical ATK");
  });
  it("reads the MMO season-buff number tag like the regular one", () => {
    const { container } = render(<GameRichText text="Cooldown: <shuzhi2>50</>s" />);
    expect(container.textContent).toBe("Cooldown: 50s");
    expect(container.querySelector(".sim-num-hl")?.textContent).toBe("50");
  });
  it("highlights a season token whole", () => {
    const { container } = render(<GameRichText text="S1 Expansion Effect: SS2 x3" />);
    expect([...container.querySelectorAll(".sim-num-hl")].map((node) => node.textContent)).toEqual(["S1", "2", "3"]);
  });
  it('reads the RU expansion tag and item-description tags without interpreting unknown HTML', () => {
    const {container} = render(<GameRichText text={'<шучжи>12.5%</> <Orange>ATK</> <green>2/4</> <red>4</> <script>x</script>'} />);
    expect(container.textContent).toBe('12.5% ATK 2/4 4 <script>x</script>');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('.sim-num-hl')?.textContent).toBe('12.5%');
  });
  it('formats epic expansion text and translated RU tags without exposing game markup', () => {
    const {container, rerender} = render(<GameRichText text={'<Blue>Base Stats</>: <Purple>ATK, HP</> (<red>4</>)'} />);
    expect(container.textContent).toBe('Base Stats: ATK, HP (4)');
    expect([...container.querySelectorAll('.sim-keyword-hl')].map(node => node.textContent)).toEqual(['Base Stats', 'ATK, HP']);
    rerender(<GameRichText rank={1} text={'<Синим>Наручи</>: <Синяя>Базовые параметры</>: <Оранжевая>АТК, ОЗ</> <зеленой>1%/2%/3%</> <красных>4</> <шужи>0,4%</> <Purple onclick="alert(1)">unsafe</> <unknown>literal</unknown>'} />);
    expect(container.textContent).toBe('Наручи: Базовые параметры: АТК, ОЗ 1%/2%/3% 4 0,4% <Purple onclick="alert(1)">unsafe</> <unknown>literal</unknown>');
    expect(container.querySelector('.sim-num-hl')?.textContent).toBe('2%');
    expect(container.querySelector('[onclick],unknown,purple')).toBeNull();
  });
  it('reads translated expansion tags in ID, PT and TH while keeping attributes escaped', () => {
    const {container} = render(<GameRichText text={'<Biru>Dasar</> <Oranye>ATK</> <Azul>Base</> <Laranja>HP</> <Vermelho>4</> <Verde>2%</> <สีส้ม>ATK</> <สีน้ำเงิน>HP</> <แว่นตาสีน้ำเงิน>ATK</> <ชุดเสริมสีน้ำเงิน>HP</> <Biru onclick="alert(1)">literal</>'} />);
    expect(container.textContent).toBe('Dasar ATK Base HP 4 2% ATK HP ATK HP <Biru onclick="alert(1)">literal</>');
    expect(container.querySelector('[onclick],biru')).toBeNull();
    expect(container.querySelectorAll('.sim-keyword-hl')).toHaveLength(8);
  });
  it("renders raid mechanic and guide tags while escaping their content", () => {
    const { container } = render(<GameRichText text={'<biaoti>Raid</> <LblRed14>Fatal Flare: dodge 3 stars. <img src=x onerror=alert(1)></>'} />);
    expect(container.textContent).toBe('Raid Fatal Flare: dodge 3 stars. <img src=x onerror=alert(1)>');
    expect(container.querySelector('strong')?.textContent).toBe('Raid');
    expect(container.querySelector('.sim-num-hl')?.textContent).toBe('3');
    expect(container.querySelector('img,script')).toBeNull();
  });
  it("keeps digits inside plain terms unhighlighted", () => {
    const { container } = render(<GameRichText plainTerms={["Calamity No. 5"]} text="Calamity No. 5 hits 3 times; calamity no. 5 <b>" />);
    expect(container.textContent).toBe("Calamity No. 5 hits 3 times; calamity no. 5 <b>");
    expect([...container.querySelectorAll(".sim-num-hl")].map((node) => node.textContent)).toEqual(["3"]);
  });
  it("rejects protocol-relative and encoded script links", () => {
    const { container } = render(
      <GameRichText
        text={'<a href="&#106;avascript:alert(1)">A</a> B'}
        links={[{ label: "B", href: "//evil.example" }]}
      />,
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("A B");
  });
  it("retains rarity labels when compact presentation has no icon", () => {
    const { container } = render(
      <GameBadge presentation="icon" variant="ssr">
        SSR
      </GameBadge>,
    );
    expect(container.querySelector('[data-presentation="label"]')?.textContent).toBe("SSR");
  });
  it("normalizes the physical element alias to the highlighted badge variant", () => {
    const { container } = render(
      <GameBadge variant="physical" presentation="icon" icon={<span aria-hidden="true" />}>
        Physical
      </GameBadge>,
    );
    expect(container.querySelector('[data-variant="phys"]')).not.toBeNull();
    expect(container.querySelector('[data-variant="physical"]')).toBeNull();
  });
  it("announces contextual loading once with decorative animation hidden", () => {
    const { getByRole } = render(
      <LoadingState fullPage message="Loading matrices…" submessage="Set effects" />,
    );
    const status = getByRole("status");
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.textContent).toContain("Loading matrices…");
    expect(status.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
