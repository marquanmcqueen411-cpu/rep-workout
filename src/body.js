// Hand-drawn front/back body map (schematic). Left-side shapes are mirrored for the right side.
const BASE = '#2a2a30';

const SIL_LEFT = `
  <rect x="38" y="80" width="22" height="86" rx="11"/>
  <rect x="34" y="160" width="20" height="78" rx="10"/>
  <ellipse cx="43" cy="246" rx="9" ry="12"/>
  <rect x="66" y="214" width="34" height="122" rx="17"/>
  <rect x="70" y="326" width="27" height="92" rx="13"/>
  <ellipse cx="82" cy="424" rx="14" ry="7"/>`;
const SIL_CENTER = `
  <ellipse cx="100" cy="32" rx="19" ry="23"/>
  <rect x="89" y="50" width="22" height="22" rx="6"/>
  <path d="M58,80 Q100,64 142,80 L148,122 Q142,170 134,206 L132,232 L68,232 L66,206 Q58,170 52,122 Z"/>`;

// muscle -> {front:{left, center}, back:{left, center}}
const SHAPES = {
  front: {
    traps: { left: `<path d="M86,62 L99,68 L99,76 L72,80 Z"/>` },
    front_delts: { left: `<ellipse cx="64" cy="90" rx="12" ry="13"/>` },
    side_delts: { left: `<ellipse cx="51" cy="96" rx="7" ry="13"/>` },
    chest: { left: `<path d="M72,92 Q86,84 99,90 L99,124 Q84,131 70,121 Q65,105 72,92Z"/>` },
    biceps: { left: `<ellipse cx="49" cy="126" rx="8.5" ry="24"/>` },
    forearms: { left: `<ellipse cx="44" cy="196" rx="8" ry="26"/>` },
    abs: { center: `<rect x="88" y="130" width="24" height="76" rx="7"/>` },
    obliques: { left: `<path d="M72,132 L85,134 L85,200 L74,198 Q67,165 72,132Z"/>` },
    quads: { left: `<ellipse cx="82" cy="276" rx="14" ry="46"/>` },
    adductors: { left: `<ellipse cx="96" cy="250" rx="4" ry="22"/>` },
    calves: { left: `<ellipse cx="80" cy="366" rx="8" ry="26"/>` },
  },
  back: {
    traps: { center: `<path d="M100,56 L126,78 L111,84 L100,132 L89,84 L74,78 Z"/>` },
    rear_delts: { left: `<ellipse cx="64" cy="90" rx="12" ry="12"/>` },
    side_delts: { left: `<ellipse cx="51" cy="96" rx="7" ry="13"/>` },
    upper_back: { left: `<path d="M75,88 L88,88 L95,120 L79,114 Z"/>` },
    lats: { left: `<path d="M71,114 Q86,124 97,140 L95,184 Q79,172 69,150 Q65,130 71,114Z"/>` },
    lower_back: { center: `<rect x="87" y="168" width="26" height="40" rx="9"/>` },
    triceps: { left: `<ellipse cx="49" cy="126" rx="8.5" ry="24"/>` },
    forearms: { left: `<ellipse cx="44" cy="196" rx="8" ry="26"/>` },
    glutes: { left: `<ellipse cx="85" cy="238" rx="16" ry="19"/>` },
    hamstrings: { left: `<ellipse cx="83" cy="294" rx="13" ry="36"/>` },
    adductors: { left: `<ellipse cx="96" cy="270" rx="3.5" ry="16"/>` },
    calves: { left: `<ellipse cx="82" cy="362" rx="10" ry="28"/>` },
  },
};

const MIRROR = 'transform="translate(200,0) scale(-1,1)"';

/** colorFor(muscleId) -> fill color or null (use dim). */
export function bodySvg(view, colorFor, { label = true, cls = '' } = {}) {
  let muscles = '';
  for (const [m, s] of Object.entries(SHAPES[view])) {
    const fill = colorFor(m) || '#3a3a42';
    const g = `fill="${fill}" data-m="${m}"`;
    if (s.left) muscles += `<g ${g}>${s.left}</g><g ${g} ${MIRROR}>${s.left}</g>`;
    if (s.center) muscles += `<g ${g}>${s.center}</g>`;
  }
  return `<svg class="body ${cls}" viewBox="0 0 200 440" role="img" aria-label="${view} body map">
    <g fill="${BASE}">${SIL_CENTER}${SIL_LEFT}<g ${MIRROR}>${SIL_LEFT}</g></g>
    <g stroke="#0d0d0f" stroke-width="1.5">${muscles}</g>
    ${view === 'front' ? `<g stroke="#0d0d0f" stroke-width="1.5"><line x1="100" y1="132" x2="100" y2="204"/><line x1="88" y1="152" x2="112" y2="152"/><line x1="88" y1="172" x2="112" y2="172"/></g>` : ''}
    ${label ? `<text x="100" y="438" text-anchor="middle" fill="#8e8e96" font-size="13" font-weight="600">${view === 'front' ? 'FRONT' : 'BACK'}</text>` : ''}
  </svg>`;
}
