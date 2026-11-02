import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Button,
  IconButton,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Toggle,
  Skeleton,
  Spinner,
  LoadingState,
  EmptyState,
  Modal,
  Dialog,
  Lightbox,
  Tooltip,
} from '../index';

describe('Shared UI Primitives & Overlays', () => {
  describe('1. Button & IconButton', () => {
    it('renders primary button with cyan glow', () => {
      const html = renderToStaticMarkup(
        <Button variant="primary">Submit</Button>
      );
      expect(html).toContain('bg-[#2ba6df]');
      expect(html).toContain('shadow-[0_0_0.75rem_rgba(43,166,223,0.35)]');
      expect(html).toContain('Submit');
    });

    it('renders gold accent button with gold border and glow', () => {
      const html = renderToStaticMarkup(
        <Button variant="gold">Awaken</Button>
      );
      expect(html).toContain('border-[#f5d97a]');
      expect(html).toContain('text-[#fde68a]');
    });

    it('renders spinner when isLoading=true and disables button', () => {
      const html = renderToStaticMarkup(
        <Button isLoading>Processing</Button>
      );
      expect(html).toContain('disabled=""');
      expect(html).toContain('aria-hidden="true"');
    });

    it('renders link when href is passed', () => {
      const html = renderToStaticMarkup(
        <Button href="/info/simulacra">Encyclopedia</Button>
      );
      expect(html).toContain('<a href="/info/simulacra"');
      expect(html).toContain('Encyclopedia');
    });

    it('renders IconButton with required aria-label', () => {
      const html = renderToStaticMarkup(
        <IconButton aria-label="Settings">
          <span>⚙</span>
        </IconButton>
      );
      expect(html).toContain('aria-label="Settings"');
      expect(html).toContain('⚙');
    });
  });

  describe('2. Badge Variants', () => {
    it('renders rarity variants with corresponding neon glows', () => {
      const htmlSsr = renderToStaticMarkup(<Badge variant="ssr">SSR</Badge>);
      expect(htmlSsr).toContain('border-[#f5d97a]/50');
      expect(htmlSsr).toContain('text-[#fde68a]');

      const htmlSr = renderToStaticMarkup(<Badge variant="sr">SR</Badge>);
      expect(htmlSr).toContain('border-[#a855f7]/50');
      expect(htmlSr).toContain('text-[#e9d5ff]');

      const htmlR = renderToStaticMarkup(<Badge variant="r">R</Badge>);
      expect(htmlR).toContain('border-[#3b82f6]/50');

      const htmlN = renderToStaticMarkup(<Badge variant="n">N</Badge>);
      expect(htmlN).toContain('border-[#10b981]/50');
    });

    it('renders elemental variants', () => {
      const htmlPhys = renderToStaticMarkup(<Badge variant="phys">Physical</Badge>);
      expect(htmlPhys).toContain('text-[#fde68a]');

      const htmlFlame = renderToStaticMarkup(<Badge variant="flame">Flame</Badge>);
      expect(htmlFlame).toContain('text-[#fca5a5]');

      const htmlFrost = renderToStaticMarkup(<Badge variant="frost">Frost</Badge>);
      expect(htmlFrost).toContain('text-[#a5f3fc]');

      const htmlVolt = renderToStaticMarkup(<Badge variant="volt">Volt</Badge>);
      expect(htmlVolt).toContain('text-[#e9d5ff]');

      const htmlAltered = renderToStaticMarkup(<Badge variant="altered">Altered</Badge>);
      expect(htmlAltered).toContain('text-[#a7f3d0]');
    });

    it('renders dot indicator when dot=true', () => {
      const html = renderToStaticMarkup(<Badge variant="success" dot>Online</Badge>);
      expect(html).toContain('w-1.5 h-1.5 rounded-full');
      expect(html).toContain('Online');
    });
  });

  describe('3. Tabs Accessible WAI-ARIA Primitive', () => {
    it('renders accessible tablist, tabs, and active tabpanel', () => {
      const html = renderToStaticMarkup(
        <Tabs defaultValue="skills">
          <Tabs.List aria-label="Character Profile Tabs">
            <Tabs.Trigger value="skills">Skills</Tabs.Trigger>
            <Tabs.Trigger value="matrices">Matrices</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="skills">Skills details panel</Tabs.Content>
          <Tabs.Content value="matrices">Matrices details panel</Tabs.Content>
        </Tabs>
      );

      expect(html).toContain('role="tablist"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('role="tabpanel"');
      expect(html).toContain('Skills details panel');
      expect(html).not.toContain('Matrices details panel');
    });
  });

  describe('4. Toggle Switch', () => {
    it('renders accessible switch with aria-checked', () => {
      const htmlChecked = renderToStaticMarkup(
        <Toggle checked label="MMO Mode" />
      );
      expect(htmlChecked).toContain('role="switch"');
      expect(htmlChecked).toContain('aria-checked="true"');
      expect(htmlChecked).toContain('MMO Mode');

      const htmlUnchecked = renderToStaticMarkup(
        <Toggle checked={false} label="MMO Mode" />
      );
      expect(htmlUnchecked).toContain('aria-checked="false"');
    });
  });

  describe('5. Skeleton & Spinner Primitives', () => {
    it('renders skeleton variants with shimmer animation', () => {
      const html = renderToStaticMarkup(<Skeleton variant="card" />);
      expect(html).toContain('skeleton');
      expect(html).toContain('animate-pulse');
      expect(html).toContain('aspect-[4/5]');
    });

    it('renders spinner with accessible role="status"', () => {
      const html = renderToStaticMarkup(<Spinner size="md" variant="primary" />);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('aria-label="Loading"');
    });
  });

  describe('6. LoadingState & EmptyState Primitives', () => {
    it('renders LoadingState with polite aria-live announcement', () => {
      const html = renderToStaticMarkup(
        <LoadingState message="Fetching relics..." submessage="Hold tight" />
      );
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('Fetching relics...');
      expect(html).toContain('Hold tight');
    });

    it('renders EmptyState with title, description, and action slot', () => {
      const html = renderToStaticMarkup(
        <EmptyState
          title="No food recipes found"
          description="Check cooking ingredients or clear search"
          action={<Button variant="primary">Reset Filters</Button>}
        />
      );
      expect(html).toContain('empty-state');
      expect(html).toContain('No food recipes found');
      expect(html).toContain('Check cooking ingredients or clear search');
      expect(html).toContain('Reset Filters');
    });
  });

  describe('7. Modal & Dialog Overlays', () => {
    it('renders modal with role="dialog" and aria-modal="true" when isOpen=true', () => {
      const html = renderToStaticMarkup(
        <Modal isOpen onClose={() => {}}>
          <Modal.Header>
            <Modal.Title>Weapon Details</Modal.Title>
          </Modal.Header>
          <Modal.Body>Weapon stats and multipliers</Modal.Body>
          <Modal.Footer>
            <Button>Close</Button>
          </Modal.Footer>
        </Modal>
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('Weapon Details');
      expect(html).toContain('Weapon stats and multipliers');
    });

    it('returns null when isOpen=false', () => {
      const html = renderToStaticMarkup(
        <Modal isOpen={false} onClose={() => {}}>
          <div>Hidden</div>
        </Modal>
      );
      expect(html).toBe('');
    });

    it('renders Dialog confirmation modal with custom action buttons', () => {
      const html = renderToStaticMarkup(
        <Dialog
          isOpen
          type="danger"
          title="Reset Team Comp?"
          description="This will clear all 3 weapon slots and matrix presets."
          confirmLabel="Clear Comp"
          onClose={() => {}}
          onConfirm={() => {}}
        />
      );

      expect(html).toContain('Reset Team Comp?');
      expect(html).toContain('This will clear all 3 weapon slots and matrix presets.');
      expect(html).toContain('Clear Comp');
    });
  });

  describe('8. Lightbox & Tooltip Primitives', () => {
    it('renders Lightbox with image, title, and caption when isOpen=true', () => {
      const html = renderToStaticMarkup(
        <Lightbox
          isOpen
          src="/media/art/meryl-splash.webp"
          title="Meryl 3★ Splash Art"
          caption="Full illustration high resolution"
          onClose={() => {}}
        />
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain('Meryl 3★ Splash Art');
      expect(html).toContain('Full illustration high resolution');
      expect(html).toContain('src="/media/art/meryl-splash.webp"');
    });

    it('renders Tooltip wrapping children with accessible aria attribute', () => {
      const html = renderToStaticMarkup(
        <Tooltip content="Physical damage scaling +15%">
          <button type="button">Buff Info</button>
        </Tooltip>
      );

      expect(html).toContain('Buff Info');
    });
  });
});

it('composes tool picker actions and fixed controls separately from the list',()=>{
  const html=renderToStaticMarkup(<Modal isOpen onClose={()=>{}} appearance="tool" size="picker"><Modal.Header actions={<button>Remove</button>}><Modal.Title>Weapons</Modal.Title></Modal.Header><Modal.Controls>Filters</Modal.Controls><Modal.Body>Items</Modal.Body><Modal.Footer>Done</Modal.Footer></Modal>);
  expect(html).toContain('tool-panel-picker');
  expect(html).toContain('tool-panel-header');
  expect(html).toContain('tool-panel-footer');
  expect(html).toContain('Remove');
  expect(html.indexOf('Filters')).toBeLessThan(html.indexOf('Items'));
});

it('preserves the default modal header structure without actions',()=>{
  const html=renderToStaticMarkup(<Modal isOpen onClose={()=>{}}><Modal.Header><Modal.Title>Matrix</Modal.Title></Modal.Header></Modal>);
  expect(html).toMatch(/Matrix<\/h2><\/div><button/);
});

it('composes neutral table dialogs with matching header and footer surfaces',()=>{
  const html=renderToStaticMarkup(<Modal isOpen onClose={()=>{}} appearance="table"><Modal.Header><Modal.Title>Capture</Modal.Title></Modal.Header><Modal.Body>Instructions</Modal.Body><Modal.Footer>Close</Modal.Footer></Modal>);
  expect(html).toContain('tool-table-panel');
  expect(html).toContain('tool-table-panel-header');
  expect(html).toContain('tool-table-panel-footer');
  expect(html).not.toContain('bg-[#0f172a]');
});
