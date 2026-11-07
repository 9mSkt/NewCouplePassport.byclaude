import type { SVGProps } from 'react';

const PATHS: Record<string, string> = {
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zm0 13a3 3 0 0 1 3-3h11M9 8h6',
  stamp: 'M9 3h6v5l2 3H7l2-3V3zM5 14h14v3H5zM7 20h10',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6zm6-2v14m6-12v14',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-9 9h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  camera: 'M4 8h4l2-3h4l2 3h4v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  plus: 'M12 5v14M5 12h14',
  send: 'M4 12l16-8-6 16-3-7-7-1z',
  pin: 'M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  gift: 'M4 10h16v4H4zM6 14h12v6H6zM12 10v10M12 10c-1-3-5-4-5-1.5S10 10 12 10zm0 0c1-3 5-4 5-1.5S14 10 12 10z',
  back: 'M15 5l-7 7 7 7',
  envelope: 'M3 6h18v12H3zM3 6l9 7 9-7',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0',
  plane: 'M3 13l7-1 4-8h2l-2 8 5 1 2-2h1l-1 4 1 4h-1l-2-2-5 1 2 8h-2l-4-8-7-1z',
  logout: 'M10 5H5v14h5M14 8l4 4-4 4M18 12H9',
};

export const ICON_NAMES = ['heart', 'stamp', 'gift', 'globe', 'star', 'plane', 'camera', 'map', 'pin', 'envelope', 'book'];

export function Icon({ name, size = 20, ...rest }: { name: string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name] ?? PATHS.star} />
    </svg>
  );
}
