/**
 * Computed-style capture. Runs inside the page via `page.evaluate()` and
 * returns a structured tally: which colors / typographies / spacings / radii
 * / shadows / borders are in use, counted by element and selectored-sampled.
 *
 * This is the DOM half of extraction. The vision pass fills in the gaps
 * (shadows on canvas-drawn UI, gradient stops, etc.).
 */
import type { Page } from 'playwright-core';

export interface ComputedTallyItem {
  value: string;
  count: number;
  sampleSelectors: string[];
  sampleElementStates: string[];
}

export interface TypographyTallyItem extends ComputedTallyItem {
  family: string;
  weight: string;
  size: string;
  lineHeight: string;
  letterSpacing: string;
  textTransform: string;
  textDecoration: string;
  fontStyle: string;
}

export interface ShadowTallyItem extends ComputedTallyItem {
  target: 'box' | 'text' | 'filter-drop';
}

export interface ComputedStylesReport {
  colors: {
    foreground: ComputedTallyItem[];
    background: ComputedTallyItem[];
    border: ComputedTallyItem[];
  };
  typography: TypographyTallyItem[];
  spacing: {
    padding: ComputedTallyItem[];
    margin: ComputedTallyItem[];
    gap: ComputedTallyItem[];
  };
  radii: ComputedTallyItem[];
  shadows: ShadowTallyItem[];
  borders: ComputedTallyItem[];
  opacities: ComputedTallyItem[];
  filters: ComputedTallyItem[];
  backdropFilters: ComputedTallyItem[];
  zIndices: ComputedTallyItem[];
  cssVariables: { name: string; value: string; scope: 'root' | 'other' }[];
  elementCount: number;
}

/**
 * Capture computed styles from the current page. Must be called AFTER the
 * page has fully loaded and any font-loading has settled.
 */
export async function captureComputedStyles(page: Page): Promise<ComputedStylesReport> {
  return page.evaluate((): ComputedStylesReport => {
    const MAX_SAMPLES = 5;
    const addSample = (item: { sampleSelectors: string[] }, selector: string) => {
      if (item.sampleSelectors.length < MAX_SAMPLES && !item.sampleSelectors.includes(selector)) {
        item.sampleSelectors.push(selector);
      }
    };

    function shortSelector(el: Element): string {
      if (el === document.body) return 'body';
      const parts: string[] = [];
      let cur: Element | null = el;
      while (cur && cur !== document.body && parts.length < 3) {
        let part = cur.tagName.toLowerCase();
        if (cur.id) {
          part += `#${cur.id}`;
          parts.unshift(part);
          break;
        }
        const className = (cur.getAttribute('class') ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((c) => `.${c}`)
          .join('');
        part += className;
        parts.unshift(part);
        cur = cur.parentElement;
      }
      return parts.join(' > ');
    }

    function isRendered(el: HTMLElement): boolean {
      if (el.offsetWidth === 0 && el.offsetHeight === 0) {
        const cs = getComputedStyle(el);
        if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
      }
      return true;
    }

    const colorMap = new Map<string, ComputedTallyItem>();
    const bgMap = new Map<string, ComputedTallyItem>();
    const borderColorMap = new Map<string, ComputedTallyItem>();
    const typographyMap = new Map<string, TypographyTallyItem>();
    const paddingMap = new Map<string, ComputedTallyItem>();
    const marginMap = new Map<string, ComputedTallyItem>();
    const gapMap = new Map<string, ComputedTallyItem>();
    const radiusMap = new Map<string, ComputedTallyItem>();
    const shadowMap = new Map<string, ShadowTallyItem>();
    const borderMap = new Map<string, ComputedTallyItem>();
    const opacityMap = new Map<string, ComputedTallyItem>();
    const filterMap = new Map<string, ComputedTallyItem>();
    const backdropMap = new Map<string, ComputedTallyItem>();
    const zIndexMap = new Map<string, ComputedTallyItem>();

    function tallyTo(
      map: Map<string, ComputedTallyItem>,
      value: string,
      selector: string,
      state: string,
    ): void {
      if (!value || value === 'none' || value === '0px' || value === 'normal') return;
      let item = map.get(value);
      if (!item) {
        item = { value, count: 0, sampleSelectors: [], sampleElementStates: [] };
        map.set(value, item);
      }
      item.count++;
      addSample(item, selector);
      if (!item.sampleElementStates.includes(state)) {
        item.sampleElementStates.push(state);
      }
    }

    let elementCount = 0;
    const all = document.body.getElementsByTagName('*');
    for (let i = 0; i < all.length && i < 5000; i++) {
      const node = all[i];
      if (!(node instanceof HTMLElement)) continue;
      if (!isRendered(node)) continue;
      elementCount++;

      const cs = getComputedStyle(node);
      const sel = shortSelector(node);

      // Colors
      tallyTo(colorMap, cs.color, sel, 'default');
      tallyTo(bgMap, cs.backgroundColor, sel, 'default');
      // Background-image (gradients) stored separately — captured by vision, but we note the raw value
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        tallyTo(bgMap, `bg-image:${cs.backgroundImage}`, sel, 'default');
      }
      tallyTo(borderColorMap, cs.borderTopColor, sel, 'default');

      // Typography (bucketed by the tuple)
      const typoKey = [
        cs.fontFamily,
        cs.fontWeight,
        cs.fontSize,
        cs.lineHeight,
        cs.letterSpacing,
        cs.textTransform,
        cs.textDecorationLine || 'none',
        cs.fontStyle,
      ].join('|');
      if (node.textContent && node.textContent.trim().length > 0) {
        let item = typographyMap.get(typoKey);
        if (!item) {
          item = {
            value: typoKey,
            count: 0,
            sampleSelectors: [],
            sampleElementStates: [],
            family: cs.fontFamily,
            weight: cs.fontWeight,
            size: cs.fontSize,
            lineHeight: cs.lineHeight,
            letterSpacing: cs.letterSpacing,
            textTransform: cs.textTransform,
            textDecoration: cs.textDecorationLine || 'none',
            fontStyle: cs.fontStyle,
          };
          typographyMap.set(typoKey, item);
        }
        item.count++;
        addSample(item, sel);
      }

      // Spacing
      for (const p of [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft]) {
        tallyTo(paddingMap, p, sel, 'default');
      }
      for (const m of [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft]) {
        tallyTo(marginMap, m, sel, 'default');
      }
      if (cs.gap && cs.gap !== 'normal') tallyTo(gapMap, cs.gap, sel, 'default');

      // Radii
      for (const r of [
        cs.borderTopLeftRadius,
        cs.borderTopRightRadius,
        cs.borderBottomRightRadius,
        cs.borderBottomLeftRadius,
      ]) {
        tallyTo(radiusMap, r, sel, 'default');
      }

      // Shadows
      if (cs.boxShadow && cs.boxShadow !== 'none') {
        const key = cs.boxShadow;
        let item = shadowMap.get(key);
        if (!item) {
          item = {
            value: key,
            count: 0,
            sampleSelectors: [],
            sampleElementStates: [],
            target: 'box',
          };
          shadowMap.set(key, item);
        }
        item.count++;
        addSample(item, sel);
      }
      if (cs.textShadow && cs.textShadow !== 'none') {
        const key = cs.textShadow;
        let item = shadowMap.get(`text:${key}`);
        if (!item) {
          item = {
            value: key,
            count: 0,
            sampleSelectors: [],
            sampleElementStates: [],
            target: 'text',
          };
          shadowMap.set(`text:${key}`, item);
        }
        item.count++;
        addSample(item, sel);
      }

      // Borders (width+style, color tracked above)
      if (cs.borderTopWidth && cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none') {
        tallyTo(borderMap, `${cs.borderTopWidth} ${cs.borderTopStyle}`, sel, 'default');
      }

      // Opacity
      if (cs.opacity && cs.opacity !== '1') {
        tallyTo(opacityMap, cs.opacity, sel, 'default');
      }

      // Filters
      if (cs.filter && cs.filter !== 'none') tallyTo(filterMap, cs.filter, sel, 'default');
      if (cs.backdropFilter && cs.backdropFilter !== 'none') {
        tallyTo(backdropMap, cs.backdropFilter, sel, 'default');
      }

      // Z-index
      if (cs.zIndex && cs.zIndex !== 'auto') tallyTo(zIndexMap, cs.zIndex, sel, 'default');
    }

    // CSS variables from :root.
    const rootStyle = getComputedStyle(document.documentElement);
    const cssVariables: { name: string; value: string; scope: 'root' | 'other' }[] = [];
    for (let i = 0; i < rootStyle.length; i++) {
      const prop = rootStyle.item(i);
      if (prop.startsWith('--')) {
        cssVariables.push({ name: prop, value: rootStyle.getPropertyValue(prop).trim(), scope: 'root' });
      }
    }

    const toArray = <T extends ComputedTallyItem>(m: Map<string, T>): T[] =>
      [...m.values()].sort((a, b) => b.count - a.count);

    return {
      colors: {
        foreground: toArray(colorMap),
        background: toArray(bgMap),
        border: toArray(borderColorMap),
      },
      typography: toArray(typographyMap),
      spacing: {
        padding: toArray(paddingMap),
        margin: toArray(marginMap),
        gap: toArray(gapMap),
      },
      radii: toArray(radiusMap),
      shadows: toArray(shadowMap),
      borders: toArray(borderMap),
      opacities: toArray(opacityMap),
      filters: toArray(filterMap),
      backdropFilters: toArray(backdropMap),
      zIndices: toArray(zIndexMap),
      cssVariables,
      elementCount,
    };
  });
}
