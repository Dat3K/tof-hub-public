import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PickerActionCard } from './index';

describe('PickerActionCard', () => {
  it('renders a button with its label, title, optional description and extra class', () => {
    const html = renderToStaticMarkup(<PickerActionCard icon="📷" title="Your image" description="PNG up to 20 MB" ariaLabel="Upload" className="min-h-[205px]" onClick={() => {}} />);
    expect(html).toContain('<button type="button" aria-label="Upload"');
    expect(html).toContain('Your image');
    expect(html).toContain('PNG up to 20 MB');
    expect(html).toContain('min-h-[205px]');
  });
  it('omits the description line when none is given', () => {
    const html = renderToStaticMarkup(<PickerActionCard icon="✎" title="Custom text" onClick={() => {}} />);
    expect(html).not.toContain('text-[9.5px]');
  });
});
