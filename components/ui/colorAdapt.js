// Tema întunecată e derivată automat din paleta luminoasă: navy-pe-ivory devine
// ivory-pe-navy prin inversarea luminozității, păstrând nuanța. Rolul culorii
// contează: același alb e suprafață când e fundal și text închis pe butoanele
// devenite deschise când e culoare de text.

// Nuanța navy a logo-ului (#202F3E): griurile neutre închise primesc tenta ei,
// ca tema întunecată să rămână „a lui Dan”, nu un gri generic.
const NAVY_HUE = 210 / 360;
const NAVY_SATURATION = 0.3;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseColor(input) {
  const value = String(input).trim().toLowerCase();
  if (value === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (value === 'black') return { r: 0, g: 0, b: 0, a: 1 };

  const hexMatch = /^#([0-9a-f]{3,8})$/.exec(value);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b, a] = hex.split('').map((ch) => parseInt(ch + ch, 16));
      return { r, g, b, a: hex.length === 4 ? a / 255 : 1 };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    return null;
  }

  const rgbMatch =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(value);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
      a: rgbMatch[4] === undefined ? 1 : Number(rgbMatch[4]),
    };
  }

  return null;
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function hueToRgb(p, q, t) {
  let tn = t;
  if (tn < 0) tn += 1;
  if (tn > 1) tn -= 1;
  if (tn < 1 / 6) return p + (q - p) * 6 * tn;
  if (tn < 1 / 2) return q;
  if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
  return p;
}

function formatHsl(h, s, l, a) {
  let r;
  let g;
  let b;
  if (s === 0) {
    r = l;
    g = l;
    b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }

  const channels = [r, g, b].map((channel) => Math.round(clamp(channel, 0, 1) * 255));
  if (a >= 1) {
    return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  }
  return `rgba(${channels.join(',')},${round(a)})`;
}

function toDark(input, role) {
  const color = parseColor(input);
  if (!color || color.a === 0) return input;

  const [h, s, l] = rgbToHsl(color.r, color.g, color.b);

  // Culorile vii (brand, statusuri) arată bine pe ambele fundaluri.
  if (s >= 0.6 && l >= 0.3 && l <= 0.7) return input;

  if (role === 'bg') {
    // Fundal video și voaluri de modal rămân întunecate.
    if (l <= 0.02 && color.a >= 1) return input;
    if (l < 0.16 && color.a <= 0.7) return input;
    // Sticla albă translucidă devine o suprafață ușor mai deschisă decât fundalul.
    if (l >= 0.88 && color.a < 0.9) {
      return `rgba(255,255,255,${round(clamp(color.a * 0.12, 0.03, 0.12))})`;
    }
    // Suprafețele opace deschise devin navy închis; albul pur (cardurile) rămâne
    // puțin mai deschis decât fundalul, ca să-și păstreze elevația.
    if (l >= 0.88) {
      const surfaceL = 0.075 + (l - 0.88) * 0.55;
      if (s < 0.35) return formatHsl(NAVY_HUE, NAVY_SATURATION, surfaceL, color.a);
      return formatHsl(h, s * 0.5, surfaceL, color.a);
    }
  }

  const invertedL = 1 - l * 0.92;
  if (invertedL < 0.3 && s < 0.2) return formatHsl(NAVY_HUE, NAVY_SATURATION, invertedL, color.a);
  const adjustedS = invertedL > 0.6 && s > 0.3 ? s * 0.8 : s;
  return formatHsl(h, adjustedS, invertedL, color.a);
}

const cache = { fg: new Map(), bg: new Map() };

/**
 * Varianta întunecată a unei culori din paleta luminoasă.
 *
 * @param {string} color
 * @param {'fg'|'bg'} [role] - 'fg' pentru text/iconițe, 'bg' pentru fundaluri și borduri.
 * @returns {string}
 */
export function darkColor(color, role = 'bg') {
  if (typeof color !== 'string') return color;
  const bucket = role === 'fg' ? cache.fg : cache.bg;
  let result = bucket.get(color);
  if (result === undefined) {
    result = toDark(color, role === 'fg' ? 'fg' : 'bg');
    bucket.set(color, result);
  }
  return result;
}
