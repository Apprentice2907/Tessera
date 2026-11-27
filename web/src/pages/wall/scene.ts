// Tessera · Memory wall: the fixed parts of the scene as SVG strings: the wire grid, the fairy lights, the spotlights
// (and a toran over a festival wall), the desk under the wall and the blurred leaves in front. Each returns what goes
// inside its <svg>; Wall.tsx draws the <svg> itself with the same attributes the classic page used.
import { PROPS } from './art';
import { SH } from './kit';
import { O, PH, PW, G } from './store';

// the wire grid: round powder-coated wires (a dark body, a highlight up-left, a shade down-right), a heavier
// frame, and two S-hooks hanging it from nails in the wall. Its shadow on the wall comes from CSS.
const WIRE: Record<string, [string, string, string]> = { black: ['#161616', 'rgba(255,255,255,.32)', ''], gold: ['#9C7628', '#F3D98E', 'rgba(70,48,10,.55)'], white: ['#EDEBE6', '#FFFFFF', 'rgba(120,112,98,.5)'] };
const grids: Record<string, string> = {};
export function grid(kind: string) {
  if (grids[kind]) return grids[kind];
  const [base, hi, lo] = WIRE[kind] || WIRE.black;
  let v = '', h = '';
  for (let x = O + G; x < PW - O - 10; x += G) v += `M${x} ${O}V${PH - O}`;
  for (let y = O + G; y < PH - O - 10; y += G) h += `M${O} ${y}H${PW - O}`;
  const wire = (d: string, w: number) => {
    const s = d ? `<path d="${d}"` : `<rect x="${O}" y="${O}" width="${PW - 2 * O}" height="${PH - 2 * O}" rx="12"`, k = (n: number) => (w * n).toFixed(2);
    return `${s} stroke="${base}" stroke-width="${w}"/>${lo ? `${s} stroke="${lo}" stroke-width="${k(.4)}" transform="translate(${k(.28)} ${k(.28)})"/>` : ''}${s} stroke="${hi}" stroke-width="${Math.max(.8, w * .3).toFixed(2)}" transform="translate(${k(-.24)} ${k(-.24)})"/>`;
  };
  const nail = (x: number) => `${SH(x, -42, 48)}<circle cx="${x + 1.5}" cy="-46" r="6" fill="#77736C"/><circle cx="${x}" cy="-47.5" r="2.4" fill="#DAD6CE"/>`;
  return (grids[kind] = `<g fill="none" stroke-linecap="round">${wire(v, 3.4)}${wire(h, 3.6)}${wire('', 7.5)}</g>${nail(Math.round(PW * .27))}${nail(Math.round(PW * .73))}`);
}

// fairy lights: strings of warm bulbs draped over the grid
function drawLights() {
  const strands: [[number, number], [number, number], number][] = [
    [[-12, 22], [PW / 3, 22], 62], [[PW / 3, 22], [PW * 2 / 3, 22], 74], [[PW * 2 / 3, 22], [PW + 12, 22], 62],
    [[16, 10], [34, PH - 10], 46], [[PW - 16, 10], [PW - 34, PH - 10], -46],
    [[-10, 322], [PW + 10, 250], 130], [[-10, PH - 40], [PW / 2, PH - 30], 34], [[PW / 2, PH - 30], [PW + 10, PH - 42], 34],
  ];
  let wires = '', bulbs = '', n = 0;
  strands.forEach(([[x1, y1], [x2, y2], sag]) => {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    // a strand sags down when it runs across, and bows inward when it runs down a side
    const c = Math.abs(dx) > Math.abs(dy) ? [mx, my + sag * 2] : [mx + sag * 2, my];
    wires += `<path d="M${x1} ${y1}Q${c[0]} ${c[1]} ${x2} ${y2}" class="wire"/>`;
    const k = Math.round(L / 34);
    for (let i = 1; i < k; i++) {
      const t = i / k, x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * c[0] + t * t * x2, y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * c[1] + t * t * y2;
      n++;
      bulbs += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="17" class="halo" style="animation-duration:${(2 + (n * 7) % 30 / 10).toFixed(1)}s;animation-delay:-${(n * 13 % 40) / 10}s"/><circle r="3.3" class="bulb"/></g>`;
    }
  });
  return `<defs><radialGradient id="bulbGlow"><stop offset="0" stop-color="#FFE2A0" stop-opacity=".95"/><stop offset=".35" stop-color="#FFC163" stop-opacity=".45"/><stop offset="1" stop-color="#FFB347" stop-opacity="0"/></radialGradient></defs>${wires}${bulbs}`;
}
let lit = '';
export const lights = () => (lit ||= drawLights());

// what is fixed to the wall itself: two spotlights, and a toran over a festival wall
const DEFS = `<defs><radialGradient id="flameGlow"><stop offset="0" stop-color="#FFD27A" stop-opacity=".85"/><stop offset=".45" stop-color="#FFA23A" stop-opacity=".3"/><stop offset="1" stop-color="#FF8A1F" stop-opacity="0"/></radialGradient><linearGradient id="cloth" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".14"/><stop offset=".5" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient><radialGradient id="cone" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#FFE3B0" stop-opacity=".5"/><stop offset="1" stop-color="#FFE3B0" stop-opacity="0"/></radialGradient></defs>`;
function fixtures(theme: string) {
  const R = PW - 330, spots = `<g class="spots"><path d="M330 10L230 420H430Z" fill="url(#cone)" class="cone"/><path d="M${R} 10L${R - 100} 420H${R + 100}Z" fill="url(#cone)" class="cone"/>${PROPS.spot(330, -2)}${PROPS.spot(R, -2)}</g>`;
  return spots + (theme === 'festival' ? PROPS.toran(230, PW - 230, 14) : '');
}
/** what goes in the back props layer: the gradients the props share, then the fixtures */
export const back = (theme: string) => DEFS + fixtures(theme);

// the desk the wall hangs over: a little succulent and a mug of chai
export const desk = () => `<svg class="dplant" width="70" height="84" viewBox="0 0 70 84" aria-hidden="true"><ellipse cx="35" cy="80" rx="22" ry="3.5" fill="#000" opacity=".22"/>${PROPS.succulent(35, 48)}</svg><svg class="mug" width="92" height="96" viewBox="0 0 92 96" aria-hidden="true"><path d="M30 26q-7-9 0-17q6-8-1-16M44 24q-7-9 0-17q6-8-1-16" stroke="#fff" stroke-opacity=".5" stroke-width="2.4" fill="none" stroke-linecap="round" class="steam" transform="translate(0 6)"/><ellipse cx="38" cy="90" rx="34" ry="5" fill="#000" opacity=".22"/><path d="M64 46q18 0 18 14t-18 14" stroke="#EDE8DE" stroke-width="7" fill="none"/><path d="M10 34h56v40q0 16-16 16H26q-16 0-16-16z" fill="#F3EFE7"/><path d="M10 52h56v8H10z" fill="#E5484D"/><path d="M14 40q2 30 10 44" stroke="#fff" stroke-width="5" fill="none" opacity=".55" stroke-linecap="round"/><path d="M50 36v48" stroke="#000" stroke-width="10" opacity=".05"/><ellipse cx="38" cy="34" rx="28" ry="6" fill="#E2DCCF"/><ellipse cx="38" cy="35" rx="23" ry="4" fill="#5B3A22"/></svg>`;
// out-of-focus pothos leaves in front of everything, bottom left
export const leaves = () => Array.from({ length: 9 }, (_, i) => PROPS.leaf(60 + (i % 3) * 50, 60 + i * 60, -40 + (i % 4) * 30, 2.6 - (i % 3) * .4, i)).join('');
