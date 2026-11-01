import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  EntityCard,
  EntityGrid,
  Card,
  Panel,
} from './index';
import { Badge } from '../primitives/badge';

describe('EntityCard & EntityGrid Primitives', () => {
  describe('1. EntityCard Rarity & Element Variants', () => {
    it('renders SSR gold border and glow styling by default or with rarity="ssr"', () => {
      const html = renderToStaticMarkup(
        <EntityCard
          title="Alyss"
          subtitle="Immortal Wings"
          rarity="ssr"
          element="frost"
          image="/media/simulacra/alyss.webp"
        />
      );

      expect(html).toContain('sim-grid-card');
      expect(html).toContain('border-[rgba(245,217,122,0.35)]');
      expect(html).toContain('Alyss');
      expect(html).toContain('Immortal Wings');
      expect(html).toContain('data-rarity="ssr"');
      expect(html).toContain('data-element="frost"');
      expect(html).toContain('SSR');
    });

    it('renders SR violet border for SR rarity items', () => {
      const html = renderToStaticMarkup(
        <EntityCard
          title="Echo"
          subtitle="Thunderous Halberd"
          rarity="sr"
          element="volt"
        />
      );

      expect(html).toContain('border-[rgba(168,85,247,0.35)]');
      expect(html).toContain('SR');
      expect(html).toContain('data-rarity="sr"');
    });

    it('renders R blue border and N emerald border', () => {
      const htmlR = renderToStaticMarkup(
        <EntityCard title="Combat Blade" rarity="r" />
      );
      expect(htmlR).toContain('border-[rgba(59,130,246,0.35)]');
      expect(htmlR).toContain('R');

      const htmlN = renderToStaticMarkup(
        <EntityCard title="Rusty Dagger" rarity="n" />
      );
      expect(htmlN).toContain('border-[rgba(16,185,129,0.35)]');
      expect(htmlN).toContain('N');
    });

    it('renders element badges and property badges in top-left overlay', () => {
      const html = renderToStaticMarkup(
        <EntityCard
          title="Lin"
          element="altered"
          property="assist"
          badges={[<span key="role" className="custom-role-badge">DPS</span>]}
        />
      );

      expect(html).toContain('sim-grid-card__badges-overlay');
      expect(html).toContain('altered');
      expect(html).toContain('assist');
      expect(html).toContain('custom-role-badge');
    });

    it('renders corner slot thumbnail for weapon badge or star rank', () => {
      const html = renderToStaticMarkup(
        <EntityCard
          title="Nemesis"
          cornerSlot={<img src="/media/weapons/nemesis.webp" alt="Weapon" className="w-8 h-8" />}
        />
      );

      expect(html).toContain('sim-grid-card__weapon-badge');
      expect(html).toContain('/media/weapons/nemesis.webp');
    });

    it('renders an art bottom-left slot above the artwork', () => {
      const html = renderToStaticMarkup(
        <EntityCard
          title="Cocoritter"
          artBottomLeftSlot={<span className="passive-stat">+2% Flame DEF</span>}
        />
      );

      expect(html).toContain('sim-grid-card__art-bottom-left');
      expect(html).toContain('passive-stat');
      expect(html).toContain('+2% Flame DEF');
    });

    it('can use the solid art stage without the transparency checkerboard', () => {
      const defaultHtml = renderToStaticMarkup(<EntityCard title="Transparent default" />);
      const solidStageHtml = renderToStaticMarkup(
        <EntityCard title="Solid stage" showTransparencyCheckerboard={false} />
      );

      expect(defaultHtml).toContain('background-image:linear-gradient');
      expect(solidStageHtml).not.toContain('background-image:linear-gradient');
    });
  });

  describe('2. EntityCard Interactivity & Comp States', () => {
    it('renders as anchor tag when href is provided', () => {
      const html = renderToStaticMarkup(
        <EntityCard
          title="Saki Fuwa"
          href="/info/simulacra/saki-fuwa"
        />
      );

      expect(html).toContain('<a href="/info/simulacra/saki-fuwa"');
      expect(html).toContain('cursor-pointer');
    });

    it('renders with selected ring when selected is true', () => {
      const html = renderToStaticMarkup(
        <EntityCard
          title="Fiona"
          selected
        />
      );

      expect(html).toContain('ring-2 ring-[#2ba6df]');
      expect(html).toContain('shadow-[0_0_18px_rgba(43,166,223,0.4)]');
    });

    it('renders loading status when loading is true', () => {
      const html = renderToStaticMarkup(
        <EntityCard
          title="Hidden while loading"
          loading
        />
      );

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html).not.toContain('Hidden while loading');
    });

    it('supports compound subcomponents composition', () => {
      const html = renderToStaticMarkup(
        <EntityCard title="Compound Entity">
          <EntityCard.Art src="/media/custom.webp" alt="Custom" />
          <EntityCard.Badges>
            <Badge variant="flame">Flame</Badge>
          </EntityCard.Badges>
          <EntityCard.RarityBadge rarity="ssr" />
          <EntityCard.CornerBadge>
            <span className="star-rank">6★</span>
          </EntityCard.CornerBadge>
          <EntityCard.Info>
            <EntityCard.Title>Custom Character</EntityCard.Title>
            <EntityCard.Subtitle>Custom Weapon</EntityCard.Subtitle>
            <EntityCard.Description>Skill descriptions here</EntityCard.Description>
            <EntityCard.Footer>
              <button type="button">Select</button>
            </EntityCard.Footer>
          </EntityCard.Info>
        </EntityCard>
      );

      expect(html).toContain('sim-grid-card__art-box');
      expect(html).toContain('Custom Character');
      expect(html).toContain('Custom Weapon');
      expect(html).toContain('Skill descriptions here');
      expect(html).toContain('star-rank');
      expect(html).toContain('Select');
    });
  });

  describe('3. EntityGrid Responsive Layout', () => {
    it('renders responsive grid with default columns and gap', () => {
      const html = renderToStaticMarkup(
        <EntityGrid>
          <div>Card 1</div>
          <div>Card 2</div>
        </EntityGrid>
      );

      expect(html).toContain('sim-grid');
      expect(html).toContain('grid-cols-2');
      expect(html).toContain('sm:grid-cols-3');
      expect(html).toContain('xl:grid-cols-6');
      expect(html).toContain('Card 1');
      expect(html).toContain('Card 2');
    });

    it('renders one accessible loading state when loading=true', () => {
      const html = renderToStaticMarkup(
        <EntityGrid loading skeletonCount={6} />
      );

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html.match(/role="status"/g)).toHaveLength(1);
    });

    it('renders EmptyState when empty=true', () => {
      const html = renderToStaticMarkup(
        <EntityGrid
          empty
          emptyTitle="No simulacra found"
          emptyDescription="Try resetting your active filters"
        />
      );

      expect(html).toContain('empty-state');
      expect(html).toContain('No simulacra found');
      expect(html).toContain('Try resetting your active filters');
    });
  });

  describe('4. Generic Card & Panel Primitives', () => {
    it('renders panel and frosted variants', () => {
      const htmlPanel = renderToStaticMarkup(
        <Panel variant="panel">
          <Card.Header>
            <Card.Title>Panel Title</Card.Title>
            <Card.Description>Panel Description</Card.Description>
          </Card.Header>
          <Card.Content>Body text</Card.Content>
          <Card.Footer>Footer</Card.Footer>
        </Panel>
      );

      expect(htmlPanel).toContain('bg-[#100d14]');
      expect(htmlPanel).toContain('Panel Title');
      expect(htmlPanel).toContain('Body text');

      const htmlFrosted = renderToStaticMarkup(
        <Card variant="frosted">
          <Card.Content>Frosted content</Card.Content>
        </Card>
      );

      expect(htmlFrosted).toContain('backdrop-blur-md');
      expect(htmlFrosted).toContain('Frosted content');
    });
  });
});

it('renders picker metadata and keeps its interactive entity identity',()=>{
  const html=renderToStaticMarkup(<EntityCard presentation="picker" title="Fairy Wreath" subtitle="Gefion" image="/weapon.webp" artZoom={1} badges={[<span key="element">Frost</span>]} raritySlot={<span>SSR</span>} selected dataId="gefion" onClick={()=>{}}/>);
  expect(html).toContain('tool-picker-card');
  expect(html).toContain('Gefion');
  expect(html).toContain('data-id="gefion"');
  expect(html).toContain('Frost');
  expect(html).toContain('SSR');
  expect(html).not.toContain('sim-grid-card__art-box');
});

it('renders a compact picker through the same selectable card API',()=>{
  const html=renderToStaticMarkup(<EntityCard presentation="picker-compact" title="V12.5" image="/suppressor.webp" artZoom={1} subtitle="Selected" description={<>ATK +1191<br/>HP +95251</>} selected dataId="12_5" onClick={()=>{}}/>);
  expect(html).toContain('tool-picker-card--compact');
  expect(html).toContain('data-id="12_5"');
  expect(html).toContain('Selected');
  expect(html).toContain('ATK +1191');
  expect(html).not.toContain('sim-grid-card__art-box');
});
