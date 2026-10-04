// Hand-drawn line icon set (24x24, stroke-based). Original artwork.
import type { JSX } from 'preact';

const P: Record<string, JSX.Element> = {
  lantern: (
    <>
      <path d="M9 4h6M12 2v2M8.5 7h7l1 2v8l-1 2h-7l-1-2V9z" />
      <path d="M8 21h8M10 10.5c.8-1 3.2-1 4 0v4.5c-.8 1-3.2 1-4 0z" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
      <path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M15.5 5.2a3 3 0 0 1 0 5.6M17.5 13.8c2 .6 3.5 2.6 3.5 5.2" />
    </>
  ),
  skills: (
    <>
      <path d="M4 20V14h4v6M10 20V9h4v11M16 20V4h4v16" />
      <path d="M3 20h18" />
    </>
  ),
  anvil: (
    <>
      <path d="M3 7h12c0 3 2 4 6 4v1c-3 0-5 1-6 3H9c-1-2-3-3-6-3z" />
      <path d="M9 15l-1 4h8l-1-4M6 19h12" />
    </>
  ),
  journal: (
    <>
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h11M9 4v6l2-1.5L13 10V4" />
    </>
  ),
  camp: (
    <>
      <path d="M3 20L12 5l9 15z" />
      <path d="M12 5v15M9.5 20l2.5-5 2.5 5M2 20h20" />
    </>
  ),
  mark: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5l3 4.5-3 4.5-3-4.5z" />
    </>
  ),
  standing: (
    <>
      <path d="M6 21V3M6 4h11l-2.5 4L17 12H6" />
    </>
  ),
  hand: (
    <>
      <path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6 7-2.5 0-4-1.2-5.5-3.5L3.8 14a1.6 1.6 0 0 1 2.7-1.6L8 14" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />,
  shield: <path d="M12 3l7 3v5c0 5-3.5 8.3-7 10-3.5-1.7-7-5-7-10V6z" />,
  sword: (
    <>
      <path d="M14.5 4H20v5.5L10 19.5 4.5 14z" />
      <path d="M7 16.5l-3 3M5.5 13l5.5 5.5" />
    </>
  ),
  bow: (
    <>
      <path d="M6 3c8 2 13 7 15 15" />
      <path d="M6 3l15 15M4 20l9-9M4 20h3M4 20v-3" />
    </>
  ),
  bolt: <path d="M13 3L5 13.5h6L10 21l8-11h-6z" />,
  skull: (
    <>
      <path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.3 4.4 3 5.5V19h9v-3c1.7-1.1 3-2.9 3-5.5A7.5 7.5 0 0 0 12 3z" />
      <circle cx="9" cy="11" r="1.6" />
      <circle cx="15" cy="11" r="1.6" />
      <path d="M10.5 19v-2.5M13.5 19v-2.5" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15z" />
      <path d="M5 19l8-8" />
    </>
  ),
  pick: (
    <>
      <path d="M4 8c4-4 10-5 16-4-3 1-6 3-8 5" />
      <path d="M13 8l-9.5 12.5M10.5 6.5l3 3" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3" />
      <circle cx="12" cy="12" r="6.5" />
    </>
  ),
  hammer: (
    <>
      <path d="M13 6l5 5M9.5 9.5L4 15l3 3 5.5-5.5" />
      <path d="M11 4l2-1 8 8-1 2-2.5-.5L12 7z" />
    </>
  ),
  flask: (
    <>
      <path d="M9.5 3h5M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" />
      <path d="M7 15h10" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  spyglass: (
    <>
      <path d="M3 15l12-8 2 3-12 8z" />
      <path d="M15 7l3-2 2.5 3.5-3 2M8 16.5L9.5 21M8 16.5L5.5 21" />
    </>
  ),
  map: (
    <>
      <path d="M3 6l6-2.5 6 2.5 6-2.5v14.5l-6 2.5-6-2.5-6 2.5z" />
      <path d="M9 3.5V18M15 6v14.5" />
    </>
  ),
  crate: (
    <>
      <path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5L12 12l9-4.5M12 12v9" />
    </>
  ),
  bunk: (
    <>
      <path d="M4 3v18M20 3v18M4 9h16M4 16h16" />
      <path d="M6 9V7.5a1.5 1.5 0 0 1 1.5-1.5H10M6 16v-1.5A1.5 1.5 0 0 1 7.5 13H10" />
    </>
  ),
  beacon: (
    <>
      <path d="M9 21l1.5-11h3L15 21M8 21h8M10 10l2-3 2 3" />
      <path d="M5 5l2.5 1.5M19 5l-2.5 1.5M12 2v2M4 10h2.5M17.5 10H20" />
    </>
  ),
  pack: (
    <>
      <path d="M7 8a5 5 0 0 1 10 0v12H7z" />
      <path d="M10 5V3.5h4V5M9 13h6v4H9z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5" />
    </>
  ),
  check: <path d="M4.5 12.5l5 5 10-11" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  back: <path d="M15 5l-7 7 7 7" />,
  alert: (
    <>
      <path d="M12 3.5L2.5 20h19z" />
      <path d="M12 10v4.5M12 17.3v.2" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />
      <path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </>
  ),
  scroll: (
    <>
      <path d="M7 4h11a2 2 0 0 1 2 2v1h-3M7 4a2 2 0 0 0-2 2v11a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3V7" />
      <path d="M9 9h7M9 12.5h7M9 16h4" />
    </>
  ),
  paw: (
    <>
      <path d="M12 13c-3 0-5.5 3-5.5 5a2 2 0 0 0 2.5 2c1.2-.3 2-.7 3-.7s1.8.4 3 .7a2 2 0 0 0 2.5-2c0-2-2.5-5-5.5-5z" />
      <ellipse cx="6" cy="10" rx="1.7" ry="2.2" />
      <ellipse cx="9.5" cy="6" rx="1.7" ry="2.3" />
      <ellipse cx="14.5" cy="6" rx="1.7" ry="2.3" />
      <ellipse cx="18" cy="10" rx="1.7" ry="2.2" />
    </>
  ),
  gem: (
    <>
      <path d="M6 4h12l3 5-9 11L3 9z" />
      <path d="M3 9h18M9 4l3 16M15 4l-3 16" />
    </>
  ),
  recipe: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h7M9 15.5h7M9 9h3" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  repeat: (
    <>
      <path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3" />
    </>
  ),
  flag: <path d="M5 21V4M5 4c3-1.5 6 1.5 9 0s4 0 5 0v9c-1 0-2-1.5-5 0s-6-1.5-9 0" />,
  mountain: <path d="M2 20l7-12 4 6 2.5-3.5L22 20z" />,
  wave: <path d="M2 9c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 15c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0" />,
  tree: (
    <>
      <path d="M12 3l6 8h-3l4 6H5l4-6H6z" />
      <path d="M12 17v4" />
    </>
  ),
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.2" />
    </>
  ),
  play: <path d="M7 4.5v15l12-7.5z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  route: (
    <>
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <path d="M8 18h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16" />
    </>
  ),
  waystone: (
    <>
      <path d="M8 21l1-14 3-4 3 4 1 14z" />
      <path d="M6 21h12M10.5 11.5h3M10 15.5h4" />
    </>
  ),
  fire: <path d="M12 21c-4 0-6.5-2.7-6.5-6.3 0-3.5 2.6-5 3.6-8.2 1.6 1 2.4 2.6 2.4 4.5 1-.6 1.6-1.8 1.6-3 2.4 1.6 3.4 4.3 3.4 6.7 0 3.6-2.5 6.3-4.5 6.3z" />,
  drop: <path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z" />,
  coil: (
    <>
      <ellipse cx="12" cy="7" rx="7" ry="2.5" />
      <path d="M5 7v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V7M5 11v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4" />
    </>
  ),
  sack: (
    <>
      <path d="M9 6l-1-2.5h8L15 6" />
      <path d="M9 6c-3 2-5 6-5 9.5C4 19 7 21 12 21s8-2 8-5.5C20 12 18 8 15 6z" />
    </>
  ),
  vial: (
    <>
      <path d="M9 3h6M10 3v4.5a5.5 5.5 0 1 0 4 0V3" />
      <path d="M12 12.5v4M10 14.5h4" />
    </>
  ),
  jar: (
    <>
      <rect x="6" y="7" width="12" height="14" rx="3" />
      <path d="M8 3h8v4H8zM9 13h6" />
    </>
  ),
  amulet: (
    <>
      <path d="M5 3c0 5 3 8 7 8s7-3 7-8" />
      <path d="M12 11l3.5 4.5L12 21l-3.5-5.5z" />
    </>
  ),
  chest: (
    <>
      <path d="M6 5c2-1 4-1.5 6-1.5S16 4 18 5l1 3v12H5V8z" />
      <path d="M5 11h14M12 11v4" />
    </>
  ),
  berry: (
    <>
      <circle cx="8" cy="15" r="3.2" />
      <circle cx="15" cy="16" r="3.2" />
      <circle cx="12" cy="10" r="3.2" />
      <path d="M12 6.8V3l3 1.5" />
    </>
  ),
  strands: <path d="M6 21c0-6 3-8 3-18M12 21c0-6-3-9 0-18M18 21c0-6-3-8-1-18" />,
  log: (
    <>
      <ellipse cx="17.5" cy="12" rx="3.5" ry="5" />
      <path d="M17.5 7H6a3.5 5 0 0 0 0 10h11.5" />
      <path d="M17.5 10.5v3" />
    </>
  ),
  crystal: (
    <>
      <path d="M12 2.5l4 5-1 11-3 3-3-3-1-11z" />
      <path d="M8 7.5h8M12 2.5v19" />
    </>
  ),
  nut: (
    <>
      <path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" />
      <circle cx="12" cy="12" r="3.2" />
    </>
  ),
  fang: <path d="M5 4h14c0 6-2.5 12-7 17C7.5 16 5 10 5 4zM8.5 4c0 4 1.4 7.5 3.5 10 2.1-2.5 3.5-6 3.5-10" />,
  beam: (
    <>
      <path d="M3 9h18v6H3z" />
      <path d="M7 9l4 6M13 9l4 6M7 15V9M17 15V9" />
    </>
  ),
  bracket: <path d="M5 4v10a6 6 0 0 0 6 6h8M5 4h4v9a3 3 0 0 0 3 3h7v4" />,
  bomb: (
    <>
      <circle cx="10.5" cy="14" r="6.5" />
      <path d="M15 9.5l2-2M17 7.5l1.5.5M18 5.5l.5-1.5M19.5 7l1.5-.5" />
    </>
  ),
  cross: <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" />,
  feather: (
    <>
      <path d="M20 4c-8 0-14 5-14 12v4" />
      <path d="M20 4c0 7-5 12-12 12M10 14l-4 6" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  upload: <path d="M12 20V9M7 14l5-5 5 5M5 4h14" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1" />
      <circle cx="15" cy="15" r="1" />
      <circle cx="15" cy="9" r="1" />
      <circle cx="9" cy="15" r="1" />
    </>
  ),
  scouting: (
    <>
      <path d="M3 15l12-8 2 3-12 8z" />
      <path d="M15 7l3-2 2.5 3.5-3 2" />
    </>
  ),
};

P.foraging = P.leaf;
P.mining = P.pick;
P.salvaging = P.nut;
P.smithing = P.hammer;
P.alchemy = P.flask;
P.engineering = P.gear;
P.overview = P.lantern;
P.expeditions = P.compass;
P.party = P.users;
P.workshop = P.anvil;

export function Icon({ name, size = 20, class: cls, title }: { name: string; size?: number; class?: string; title?: string }) {
  const body = P[name] ?? P.info;
  return (
    <svg
      class={`icon ${cls ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {body}
    </svg>
  );
}

export function hasIcon(name: string): boolean {
  return !!P[name];
}
