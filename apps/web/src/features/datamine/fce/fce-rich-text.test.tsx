import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderFceMechanicText } from './fce-rich-text';

function render(value: string): string {
  return renderToStaticMarkup(React.createElement(React.Fragment, null, renderFceMechanicText(value)));
}

describe('renderFceMechanicText', () => {
  it('preserves the legacy accent span and decodes safe text entities', () => {
    expect(render('Boss&#x27;s <span class="fce-card__text-accent">shield</span>')).toBe(
      'Boss&#x27;s <span class="fce-card__text-accent">shield</span>'
    );
  });

  it('renders unsupported markup as text instead of executable HTML', () => {
    const markup = render('<img src=x onerror=alert(1)><script>alert(1)</script>');

    expect(markup).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(markup).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(markup).not.toContain('<script>');
  });
});
