// Generates flat vector portrait avatars used across the page.
import { writeFileSync, mkdirSync } from 'node:fs';

const out = process.argv[2];
mkdirSync(out, { recursive: true });

const SKIN = ['#F2C9A0', '#E8B187', '#C98B62', '#9A5F3D', '#6E4028', '#F7D7B8'];
const HAIR = ['#2B2118', '#4A3222', '#7A4A25', '#1A1614', '#8C6239', '#3D2B1F', '#C9A227'];
const BG = ['#E9DEFF', '#DFF6C2', '#FFE6EF', '#FFF0CC', '#D9EBFF', '#EDE4FF', '#E4F7E0', '#FFE9D6'];
const TOP = ['#7C3AED', '#111111', '#C7F53F', '#FF4D8D', '#3B9EFF', '#FFC93D', '#4C1D95', '#2F855A'];

// hair style renderers, drawn on top of the head
const styles = {
  short: (c) => `<path d="M28 42c0-13 10-21 22-21s22 8 22 21c0 0-4-8-22-8s-22 8-22 8z" fill="${c}"/>`,
  buzz: (c) => `<path d="M30 40c0-12 9-19 20-19s20 7 20 19c-3-6-11-9-20-9s-17 3-20 9z" fill="${c}"/>`,
  bun: (c) => `<g fill="${c}"><circle cx="50" cy="16" r="8"/><path d="M28 44c0-14 10-23 22-23s22 9 22 23c0 0-3-11-22-11s-22 11-22 11z"/></g>`,
  long: (c) => `<g fill="${c}"><path d="M26 46c0-16 11-25 24-25s24 9 24 25v22c0 3-7 3-7 0V45c0-8-8-11-17-11s-17 3-17 11v23c0 3-7 3-7 0z"/></g>`,
  bob: (c) => `<path d="M26 48c0-17 11-27 24-27s24 10 24 27c0 5-1 9-3 12-1-4-2-14-2-20 0-6-8-8-19-8s-19 2-19 8c0 6-1 16-2 20-2-3-3-7-3-12z" fill="${c}"/>`,
  curly: (c) => `<g fill="${c}"><circle cx="34" cy="30" r="10"/><circle cx="50" cy="23" r="11"/><circle cx="66" cy="30" r="10"/><circle cx="30" cy="42" r="8"/><circle cx="70" cy="42" r="8"/></g>`,
  cap: () => `<g><path d="M27 39c0-13 10-21 23-21s23 8 23 21z" fill="#111"/><path d="M25 39h50a3 3 0 0 1 0 6H25a3 3 0 0 1 0-6z" fill="#2B2B2B"/><circle cx="50" cy="24" r="3" fill="#C7F53F"/></g>`,
  wavy: (c) => `<path d="M27 45c0-15 10-24 23-24s23 9 23 24c0 4-1 7-2 9-2-5-1-13-4-16-4 4-12 5-17 5s-13-1-17-5c-3 3-2 11-4 16-1-2-2-5-2-9z" fill="${c}"/>`,
};
const styleNames = Object.keys(styles);

const total = 14;
for (let i = 0; i < total; i++) {
  const skin = SKIN[i % SKIN.length];
  const hair = HAIR[(i * 3 + 1) % HAIR.length];
  const bg = BG[i % BG.length];
  const top = TOP[(i * 5 + 2) % TOP.length];
  const style = styleNames[i % styleNames.length];
  const beard = i % 4 === 1;
  const smile = i % 3 !== 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Photo de profil">
<defs><clipPath id="c${i}"><circle cx="50" cy="50" r="50"/></clipPath></defs>
<g clip-path="url(#c${i})">
<rect width="100" height="100" fill="${bg}"/>
<path d="M50 72c16 0 29 10 31 28H19c2-18 15-28 31-28z" fill="${top}"/>
<path d="M42 62h16v14H42z" fill="${skin}"/>
<ellipse cx="50" cy="45" rx="20" ry="23" fill="${skin}"/>
${beard ? `<path d="M31 45c0 16 8 24 19 24s19-8 19-24c1 9 0 16-3 21-4 6-9 9-16 9s-12-3-16-9c-3-5-4-12-3-21z" fill="${hair}" opacity=".9"/>` : ''}
${styles[style](hair)}
<circle cx="42" cy="46" r="2.4" fill="#231A14"/>
<circle cx="58" cy="46" r="2.4" fill="#231A14"/>
${smile
    ? `<path d="M44 55c2 2.6 4 3.9 6 3.9s4-1.3 6-3.9" stroke="#231A14" stroke-width="2.2" stroke-linecap="round" fill="none"/>`
    : `<path d="M44.5 56.5h11" stroke="#231A14" stroke-width="2.2" stroke-linecap="round"/>`}
</g>
</svg>
`;
  writeFileSync(`${out}/avatar-${i + 1}.svg`, svg);
}
console.log(`wrote ${total} avatars`);
