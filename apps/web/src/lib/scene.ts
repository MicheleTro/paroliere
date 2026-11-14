import type { DayState } from './week.js';

// La scena della home (docs/prototipo-gamification.html): un ramo con sette nodi, uno per giorno della settimana,
// il bradipo che avanza con l'ora, stagioni, giorno e notte. Il disegno è una stringa SVG generata da dati.

export type SeasonName = 'autunno' | 'inverno' | 'primavera' | 'estate';

interface SeasonStyle {
  sky: [string, string];
  night: [string, string];
  hills: [string, string, string];
  bark: string;
  leaf: string[];
  fall: 'leaf' | 'snow' | 'petal' | null;
  snow?: boolean;
}

const SEASONS: Record<SeasonName, SeasonStyle> = {
  autunno: {
    sky: ['#ffb877', '#ffe2b8'],
    night: ['#28245a', '#5a4a8a'],
    hills: ['#e98d4f', '#c96a35', '#a8522a'],
    bark: '#7a4a2c',
    leaf: ['#ff6a2b', '#ffa22e', '#e0402a', '#ffc53d'],
    fall: 'leaf',
  },
  inverno: {
    sky: ['#9fc9f5', '#e6f2ff'],
    night: ['#1b2350', '#3a4a86'],
    hills: ['#ffffff', '#e4eefb', '#cddcf2'],
    bark: '#6a4a38',
    leaf: [],
    fall: 'snow',
    snow: true,
  },
  primavera: {
    sky: ['#8fd6f0', '#e2f8ea'],
    night: ['#22285a', '#47558e'],
    hills: ['#9ad97a', '#73c060', '#56a64c'],
    bark: '#7a5236',
    leaf: ['#ff8fbf', '#ffc4dc', '#ffffff', '#8fdc6c'],
    fall: 'petal',
  },
  estate: {
    sky: ['#59bff5', '#c9eeff'],
    night: ['#16245a', '#2f4b8e'],
    hills: ['#7fd16a', '#5cb553', '#43963f'],
    bark: '#6b4630',
    leaf: ['#3fae4f', '#64c95b', '#2f8a3f', '#9ee05e'],
    fall: null,
  },
};

/** Stagione del calendario: dicembre–febbraio inverno, marzo–maggio primavera, giugno–agosto estate, il resto autunno. */
export function seasonOf(date: Date): SeasonName {
  const month = date.getMonth();
  if (month <= 1 || month === 11) return 'inverno';
  if (month <= 4) return 'primavera';
  if (month <= 7) return 'estate';
  return 'autunno';
}

/** Di notte dalle 20 alle 7. */
export function isNightAt(date: Date): boolean {
  const hour = date.getHours();
  return hour < 7 || hour >= 20;
}

export interface SceneDay {
  name: string;
  glyph: string;
  color: string;
  state: DayState;
  /** Punteggio, se la griglia è stata giocata. */
  score: number | null;
  /** Etichetta di tre lettere del giorno (LUN…). */
  short: string;
  /** Descrizione per chi usa uno screen reader. */
  label: string;
}

export interface SceneInput {
  width: number;
  height: number;
  season: SeasonName;
  night: boolean;
  days: SceneDay[];
  todayIndex: number;
  /** Frazione di giornata trascorsa (0..1): sposta il bradipo lungo il ramo. */
  dayFraction: number;
}

const INK = '#1d1a3a';
const FONT = 'Lilita One, Arial Rounded MT Bold, sans-serif';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

interface Point {
  x: number;
  y: number;
}
type Segment = [Point, Point, Point, Point];

function bez(p0: Point, c1: Point, c2: Point, p1: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
  };
}

function geometry(W: number, H: number) {
  const top = Math.max(175, H * 0.2);
  const bottom = H - Math.max(170, H * 0.2);
  const xs = [0.3, 0.7, 0.3, 0.7, 0.3, 0.7, 0.5];
  const nodes: Point[] = xs.map((x, i) => ({ x: W * x, y: bottom - ((bottom - top) * i) / 6 }));
  const pts: Point[] = [{ x: W * 0.05, y: H + 40 }, ...nodes, { x: W * 0.9, y: -40 }];
  const segs: Segment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    segs.push([
      p1,
      { x: p1.x + (p2.x - p0.x) / 5, y: p1.y + (p2.y - p0.y) / 5 },
      { x: p2.x - (p3.x - p1.x) / 5, y: p2.y - (p3.y - p1.y) / 5 },
      p2,
    ]);
  }
  const d =
    `M${pts[0]!.x} ${pts[0]!.y}` + segs.map((s) => ` C${s[1].x} ${s[1].y} ${s[2].x} ${s[2].y} ${s[3].x} ${s[3].y}`).join('');
  return { nodes, segs, d };
}

export function slothSvg(): string {
  return `<g class="sloth-bob">
  <g stroke="${INK}" stroke-width="3" stroke-linecap="round" fill="none">
   <path d="M-26 -2 Q-34 14 -20 26"/><path d="M-12 -2 Q-16 14 -6 26"/><path d="M8 -2 Q4 14 12 26"/><path d="M22 -2 Q26 14 18 26"/></g>
  <g stroke="#8a6646" stroke-width="8" stroke-linecap="round" fill="none">
   <path d="M-26 -2 Q-34 14 -20 26"/><path d="M-12 -2 Q-16 14 -6 26"/><path d="M8 -2 Q4 14 12 26"/><path d="M22 -2 Q26 14 18 26"/></g>
  <path d="M-30 -5 l2 6 M-26 -6 l1 6 M-15 -5 l2 6 M5 -5 l2 6 M19 -5 l2 6 M23 -6 l1 6" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
  <ellipse cx="-2" cy="30" rx="28" ry="16" fill="#9a7552" stroke="${INK}" stroke-width="3"/>
  <path d="M-20 26 q5 4 10 0 M-4 36 q5 4 10 0 M8 24 q5 4 10 0" stroke="#6f5038" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="26" cy="30" r="15" fill="#b08a63" stroke="${INK}" stroke-width="3"/>
  <ellipse cx="27" cy="32" rx="11.5" ry="9.5" fill="#f4e7cf"/>
  <ellipse cx="21.5" cy="30" rx="4.6" ry="2.8" fill="#4a3426" transform="rotate(-20 21.5 30)"/>
  <ellipse cx="32.5" cy="30" rx="4.6" ry="2.8" fill="#4a3426" transform="rotate(20 32.5 30)"/>
  <g class="blink"><circle cx="22.4" cy="30" r="1.6" fill="#fff"/><circle cx="31.6" cy="30" r="1.6" fill="#fff"/></g>
  <ellipse cx="27" cy="35" rx="2.4" ry="1.7" fill="${INK}"/>
  <path d="M23.5 38.2 Q27 41 30.5 38.2" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <ellipse cx="18" cy="37" rx="2.4" ry="1.4" fill="#ff9c8a" opacity=".7"/><ellipse cx="36" cy="37" rx="2.4" ry="1.4" fill="#ff9c8a" opacity=".7"/>
</g>`;
}

export function slothHeadSvg(): string {
  return `<svg viewBox="-2 12 58 40" class="head"><g transform="translate(-1,0)"><circle cx="27" cy="31" r="17" fill="#b08a63" stroke="${INK}" stroke-width="3"/>
  <ellipse cx="27" cy="33" rx="13" ry="10.5" fill="#f4e7cf"/><ellipse cx="21" cy="31" rx="5" ry="3" fill="#4a3426" transform="rotate(-20 21 31)"/><ellipse cx="33" cy="31" rx="5" ry="3" fill="#4a3426" transform="rotate(20 33 31)"/>
  <circle cx="22" cy="31" r="1.7" fill="#fff"/><circle cx="32" cy="31" r="1.7" fill="#fff"/><ellipse cx="27" cy="36" rx="2.5" ry="1.8" fill="${INK}"/><path d="M23 39.5 Q27 42.5 31 39.5" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/></g></svg>`;
}

/** La stella del livello (HUD e profilo). */
export function starSvg(fill: string): string {
  return `<svg viewBox="0 0 60 60"><path d="M30 3l7.6 15.4 17 2.5-12.3 12 2.9 16.9L30 41.8 14.8 49.8l2.9-16.9L5.4 20.9l17-2.5z" fill="${fill}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/></svg>`;
}

function escapeXml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function nodeSvg(day: SceneDay, index: number, position: Point, todayIndex: number): string {
  const done = day.state === 'played' || day.state === 'lost';
  const future = day.state === 'locked' || day.state === 'blocked';
  const today = index === todayIndex;
  const R = today ? 33 : 28;
  const face = day.state === 'played' ? '#ffc53d' : day.state === 'lost' ? '#e3d9c2' : future ? '#cdd3e3' : day.color;
  const glyphSize = day.glyph.length > 2 ? (today ? 21 : 18) : today ? 27 : 23;
  const badgeFill = day.state === 'played' ? '#25c88d' : day.state === 'lost' ? '#ff5e4b' : today ? '#ff5e4b' : '#fffaf0';
  const badgeText = day.state === 'played' ? `${day.score ?? 0} pt` : day.state === 'lost' ? '0 pt' : day.short;
  const badgeInk = done || today ? '#fff' : INK;

  const corner = future
    ? `<g transform="translate(${R * 0.72},${-R * 0.72})"><circle r="11" fill="#cdd3e3" stroke="${INK}" stroke-width="2.5"/><path d="M-4 -1v-3a4 4 0 0 1 8 0v3M-6 -1h12v8h-12z" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/></g>`
    : day.state === 'played'
      ? `<g transform="translate(${R * 0.72},${-R * 0.72})"><circle r="11" fill="#25c88d" stroke="${INK}" stroke-width="2.5"/><path d="M-5 0l3.5 3.5L5 -4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>`
      : !done && !today
        ? `<g transform="translate(${R * 0.72},${-R * 0.72})"><circle r="11" fill="#ff5e4b" stroke="${INK}" stroke-width="2.5"/><text y="5.5" text-anchor="middle" font-family="${FONT}" font-size="16" fill="#fff">!</text></g>`
        : '';

  return `<g class="node" data-node="${index}" tabindex="0" role="button" aria-label="${escapeXml(day.label)}" transform="translate(${position.x},${position.y})">
      ${today && !done ? `<circle class="pulse" r="${R}" fill="none" stroke="#ffc53d" stroke-width="6"/>` : ''}
      <circle r="${R}" cy="5" fill="${INK}"/>
      <circle class="face" r="${R}" fill="${face}" stroke="${INK}" stroke-width="3.5"/>
      <ellipse rx="${R * 0.55}" ry="${R * 0.22}" cy="${-R * 0.55}" fill="#fff" opacity=".45"/>
      <text y="${day.glyph.length > 2 ? 7 : 9}" text-anchor="middle" font-family="${FONT}" font-size="${glyphSize}" fill="${future ? '#9aa3bd' : INK}">${escapeXml(day.glyph)}</text>
      <g transform="translate(0,${R + 14})"><rect x="-27" y="-11" width="54" height="22" rx="11" fill="${badgeFill}" stroke="${INK}" stroke-width="2.5"/>
        <text y="5" text-anchor="middle" font-family="${FONT}" font-size="13" fill="${badgeInk}">${escapeXml(badgeText)}</text></g>
      ${corner}
    </g>`;
}

/** Il disegno completo della scena, come stringa SVG. */
export function buildScene(input: SceneInput): string {
  const { width: W, height: H, night, days, todayIndex } = input;
  const style = SEASONS[input.season];
  const sky = night ? style.night : style.sky;
  const geom = geometry(W, H);

  // Foglie, petali o neve che cadono
  const falls: string[] = [];
  if (style.fall) {
    for (let i = 0; i < 12; i++) {
      const x = hash(`f${i}`) * W;
      const duration = 9 + hash(`d${i}`) * 8;
      const delay = -hash(`e${i}`) * 16;
      const shape =
        style.fall === 'snow'
          ? `<circle r="${2.5 + hash(`s${i}`) * 2.5}" fill="#fff" stroke="${INK}" stroke-width="1"/>`
          : `<ellipse rx="${style.fall === 'petal' ? 5 : 7}" ry="${style.fall === 'petal' ? 4 : 3.5}" fill="${style.leaf[i % style.leaf.length]}" stroke="${INK}" stroke-width="1.5"/>`;
      falls.push(
        `<g transform="translate(${x},0)"><g class="fall" style="animation-duration:${duration}s;animation-delay:${delay}s">${shape}</g></g>`,
      );
    }
  }

  // Stelle di notte, nuvole di giorno
  const skyDecor = night
    ? Array.from(
        { length: 28 },
        (_, i) =>
          `<circle cx="${hash(`sx${i}`) * W}" cy="${hash(`sy${i}`) * H * 0.6}" r="${1 + hash(`sr${i}`) * 1.8}" fill="#fff" opacity="${0.5 + hash(`so${i}`) * 0.5}"/>`,
      ).join('')
    : (
        [
          [60, H * 0.3, 1],
          [300, H * 0.16, 0.8],
          [250, H * 0.5, 0.7],
        ] as const
      )
        .map(
          ([x, y, k], i) => `<g class="cloud" style="animation-duration:${40 + i * 15}s;animation-direction:alternate"><g transform="translate(${x},${y}) scale(${k})">
      <g fill="${INK}"><circle cx="-24" cy="4" r="17"/><circle cx="0" cy="-6" r="23"/><circle cx="26" cy="4" r="17"/><rect x="-42" y="4" width="86" height="18" rx="9"/></g>
      <g fill="#fff"><circle cx="-24" cy="4" r="14"/><circle cx="0" cy="-6" r="20"/><circle cx="26" cy="4" r="14"/><rect x="-39" y="6" width="80" height="13" rx="6"/></g></g></g>`,
        )
        .join('');

  // Rametti e foglie lungo il ramo
  const twigs: string[] = [];
  const leaves: string[] = [];
  geom.segs.forEach((segment, i) => {
    [0.35, 0.7].forEach((t, k) => {
      const p = bez(...segment, t);
      const side = (i + k) % 2 ? 1 : -1;
      const len = 30 + hash(`tw${i}${k}`) * 18;
      const e = { x: p.x + side * len, y: p.y - len * 0.7 };
      const curve = `M${p.x} ${p.y} Q ${p.x + side * len * 0.4} ${p.y - len * 0.2} ${e.x} ${e.y}`;
      twigs.push(
        `<path d="${curve}" stroke="${INK}" stroke-width="9" stroke-linecap="round" fill="none"/><path d="${curve}" stroke="${style.bark}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
      );
      if (style.leaf.length) {
        for (let j = 0; j < 4; j++) {
          const angle = hash(`la${i}${k}${j}`) * 360;
          const ox = e.x + (hash(`lx${i}${k}${j}`) - 0.5) * 26;
          const oy = e.y + (hash(`ly${i}${k}${j}`) - 0.5) * 22;
          const color = style.leaf[(i + j) % style.leaf.length]!;
          leaves.push(
            style.fall === 'petal' && j % 2
              ? `<g transform="translate(${ox},${oy})"><circle r="7" fill="${color}" stroke="${INK}" stroke-width="2"/><circle r="2.5" fill="#ffd34d"/></g>`
              : `<ellipse cx="${ox}" cy="${oy}" rx="11" ry="6" fill="${color}" stroke="${INK}" stroke-width="2" transform="rotate(${angle} ${ox} ${oy})"/>`,
          );
        }
      }
      if (style.snow) leaves.push(`<ellipse cx="${e.x}" cy="${e.y - 3}" rx="9" ry="4" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`);
    });
  });

  const nodes = days.map((day, i) => nodeSvg(day, i, geom.nodes[i]!, todayIndex)).join('');

  // Il bradipo avanza lungo il ramo durante la giornata
  let pos: Point;
  let tangent: Point;
  if (todayIndex < 6) {
    const segment = geom.segs[todayIndex + 1]!;
    pos = bez(...segment, 0.3 + input.dayFraction * 0.4);
    const next = bez(...segment, 0.32 + input.dayFraction * 0.4);
    tangent = { x: next.x - pos.x, y: next.y - pos.y };
  } else {
    pos = geom.nodes[6]!;
    tangent = { x: 1, y: -0.2 };
  }
  const flip = tangent.x < 0 ? -1 : 1;
  const angle = Math.max(-40, Math.min(40, (Math.atan2(tangent.y, Math.abs(tangent.x)) * 180) / Math.PI));

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Sloth's week: un ramo con sette giorni">
    <defs><linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#skyg)"/>
    ${skyDecor}
    ${
      night
        ? `<g transform="translate(${W * 0.9},${H * 0.47})"><circle r="30" fill="#fff6d8" stroke="${INK}" stroke-width="3.5"/><circle cx="-9" cy="-6" r="5" fill="#efe3b8"/><circle cx="8" cy="9" r="4" fill="#efe3b8"/></g>`
        : `<g transform="translate(${W * 0.9},${H * 0.47})"><circle r="44" fill="#ffe27a" opacity=".35"/><circle r="30" fill="#ffd84d" stroke="${INK}" stroke-width="3.5"/></g>`
    }
    <path d="M0 ${H * 0.72} Q ${W * 0.25} ${H * 0.64} ${W * 0.5} ${H * 0.7} T ${W} ${H * 0.66} V${H} H0Z" fill="${style.hills[0]}" stroke="${INK}" stroke-width="3" ${night ? 'opacity=".55"' : ''}/>
    <path d="M0 ${H * 0.82} Q ${W * 0.3} ${H * 0.74} ${W * 0.6} ${H * 0.81} T ${W} ${H * 0.78} V${H} H0Z" fill="${style.hills[1]}" stroke="${INK}" stroke-width="3" ${night ? 'opacity=".6"' : ''}/>
    <path d="M0 ${H * 0.92} Q ${W * 0.35} ${H * 0.86} ${W * 0.7} ${H * 0.92} T ${W} ${H * 0.9} V${H} H0Z" fill="${style.hills[2]}" stroke="${INK}" stroke-width="3" ${night ? 'opacity=".7"' : ''}/>
    <g>${twigs.join('')}</g>
    <path d="${geom.d}" stroke="${INK}" stroke-width="30" stroke-linecap="round" fill="none"/>
    <path d="${geom.d}" stroke="${style.bark}" stroke-width="23" stroke-linecap="round" fill="none"/>
    <path d="${geom.d}" stroke="rgba(255,255,255,.22)" stroke-width="5" stroke-linecap="round" fill="none" transform="translate(-3,-6)"/>
    ${style.snow ? `<path d="${geom.d}" stroke="#fff" stroke-width="9" stroke-linecap="round" fill="none" transform="translate(0,-9)"/>` : ''}
    <g>${leaves.join('')}</g>
    <g transform="translate(${pos.x},${pos.y + 9}) rotate(${angle * flip}) scale(${flip * 1.25},1.25)">${slothSvg()}</g>
    ${nodes}
    <g>${falls.join('')}</g>
  </svg>`;
}
