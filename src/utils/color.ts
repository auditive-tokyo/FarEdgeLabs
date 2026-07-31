/**
 * Colour parsing helpers.
 *
 * WebGL uniforms take normalised floats, while the design system keeps every
 * colour as a CSS token. These helpers bridge the two so a shader can read a
 * token instead of hardcoding a value (see obsidian/frontend/design-system.md).
 */

/** Normalised 0–1 RGB triplet — the form a `vec3` colour uniform expects. */
export type Rgb = [number, number, number];

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_PATTERN = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i;

const expandShorthand = (hex: string): string =>
  hex.length === 3
    ? hex
        .split("")
        .map((char) => char + char)
        .join("")
    : hex;

/**
 * Parse a CSS colour string into normalised RGB.
 *
 * Handles the notations the design tokens are authored in (`#rgb`, `#rrggbb`,
 * `rgb()`, `rgba()`); anything else yields `null` so the caller can fall back.
 */
export const parseCssColor = (value: string): Rgb | null => {
  const input = value.trim();

  const hex = HEX_PATTERN.exec(input);
  if (hex) {
    const digits = expandShorthand(hex[1]);
    return [0, 2, 4].map((offset) =>
      parseInt(digits.slice(offset, offset + 2), 16) / 255,
    ) as Rgb;
  }

  const rgb = RGB_PATTERN.exec(input);
  if (rgb) {
    return [1, 2, 3].map((group) =>
      Math.min(Number(rgb[group]) / 255, 1),
    ) as Rgb;
  }

  return null;
};

/**
 * Read a CSS custom property off `element` and parse it as a colour.
 *
 * @param element - the element to resolve the cascade against.
 * @param property - custom property name, including the leading `--`.
 * @param fallback - returned when the property is unset or unparseable.
 */
export const readCssColor = (
  element: Element,
  property: string,
  fallback: Rgb,
): Rgb => {
  const value = getComputedStyle(element).getPropertyValue(property);
  return parseCssColor(value) ?? fallback;
};

/*
 * `rgbToHex` lived here too. It existed to feed `<input type="color">` in the
 * halftone colour panel, which is gone — the field's colours are settled and
 * live in `globals.css`. It went with it rather than staying as a helper with
 * no caller and a rationale about a component that no longer exists.
 */
