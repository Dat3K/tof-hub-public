import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {IconLabel} from './handbook-ui';

afterEach(() => {cleanup(); vi.restoreAllMocks();});
const icon = '/game-assets/webp/Hotta/Content/Test/fixture.webp';

it('only enables icon inspection after the thumbnail has loaded', () => {
  const onOpen = vi.fn();
  const {container} = render(<IconLabel icon={icon} label="Fixture effect" iconAction={{label: 'View fixture', onOpen}} />);
  const button = screen.getByRole('button', {name: 'View fixture'}) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.load(container.querySelector('img')!);
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  expect(onOpen).toHaveBeenCalledOnce();
});

it('keeps a blank noninteractive slot for a cached failure even without a new error event', () => {
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
  const {container} = render(<IconLabel icon={icon} label="Missing fixture" iconAction={{label: 'View fixture', onOpen: vi.fn()}} />);
  expect(screen.getByText('Missing fixture')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
});
