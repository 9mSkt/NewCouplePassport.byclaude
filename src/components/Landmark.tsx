import type { SVGProps } from 'react';

/**
 * Line-art landmark icons (24×24, stroke only) for the main city of each country.
 * Countries without a dedicated landmark fall back to a generic city skyline.
 */
const SHAPES: Record<string, string[]> = {
  // Tokyo Tower
  tokyoTower: ['M12 2v3', 'M10.8 5h2.4l.8 4h-4z', 'M9 9h6v2H9z', 'M9.5 11L7 21M14.5 11L17 21', 'M8.3 15.5h7.4', 'M4 21h16'],
  // Eiffel Tower
  eiffel: ['M12 2v2', 'M11 4h2l1.2 7h-4.4z', 'M9.3 11h5.4', 'M9.8 11Q9 17 6 21M14.2 11Q15 17 18 21', 'M8.7 15h6.6', 'M9.5 21a2.5 2.5 0 0 1 5 0', 'M4 21h16'],
  // Colosseum
  colosseum: [
    'M3 21V10c3-1.3 6-2 9-2s6 .7 9 2v11',
    'M3 15h18',
    'M6 21v-2.5a1 1 0 0 1 2 0V21M11 21v-2.5a1 1 0 0 1 2 0V21M16 21v-2.5a1 1 0 0 1 2 0V21',
    'M6 13v-1.5M9 13v-2M12 13v-2M15 13v-2M18 13v-1.5',
    'M2 21h20',
  ],
  // N Seoul Tower on Namsan
  namsan: ['M12 2v4', 'M9.5 6h5l-1 2.5h-3z', 'M11 8.5v8M13 8.5v8', 'M2 21c3-4 6-5 10-5s7 1 10 5'],
  // Wat Arun prang
  prang: ['M12 2v3', 'M10 5h4l1 6H9z', 'M8 11h8l1 5H7z', 'M5 16h14v5H5z', 'M11 21v-2.5h2V21', 'M3 21h18'],
  // Buddhist stupa (Shwedagon, That Luang, Boudhanath …)
  stupa: ['M12 2v3', 'M9 13c0-4 1.5-6.5 3-8 1.5 1.5 3 4 3 8z', 'M7 13h10v3H7z', 'M5 16h14v5H5z', 'M3 21h18'],
  // Big Ben
  bigBen: ['M10.5 8L12 3l1.5 5', 'M9.5 8h5', 'M10 8v13M14 8v13', 'M10.7 11.5a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0', 'M10 15h4', 'M6 21h12'],
  // Statue of Liberty
  liberty: ['M14 7.5l1.5-4.5', 'M14.5 3h2', 'M10.5 5.5l-1-1M12 5V4M13.5 5.5l1-1', 'M10.5 7a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0', 'M10.5 9h3l1 7h-5z', 'M8.5 16h7v5h-7z', 'M5 21h14'],
  // Sydney Opera House
  opera: [
    'M5 18c0-4 2-7 5-8-1 3-1 5.5 0 8M10 18c0-5 2.5-8.5 6-9.5-1 3.5-1 6.5 0 9.5M16 18c0-3.5 1.5-6 4-7-.7 2.5-.7 4.5 0 7',
    'M3 18h18',
    'M3 21c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0',
  ],
  // Marina Bay Sands
  mbs: ['M3 6h18c-.5 1-1.5 1.5-2.5 1.5h-13C4.5 7.5 3.5 7 3 6z', 'M5.5 7.5h3V21h-3zM10.5 7.5h3V21h-3zM15.5 7.5h3V21h-3z', 'M3 21h18'],
  // Petronas Twin Towers
  petronas: ['M6 21V8l1.5-2L9 8v13M15 21V8l1.5-2L18 8v13', 'M7.5 6V2.5M16.5 6V2.5', 'M9 12h6', 'M6 15h3M15 15h3', 'M3 21h18'],
  // Burj Khalifa
  burj: ['M12 2v3', 'M11 5h2l.5 4h-3z', 'M10 9h4l.5 5h-5z', 'M9 14h6l.5 7h-7z', 'M5 21h14'],
  // Taj Mahal
  taj: ['M12 6V3.5', 'M8 12c0-3 2-4 4-6 2 2 4 3 4 6z', 'M7 12h10v9H7z', 'M10.5 21v-3a1.5 1.5 0 0 1 3 0v3', 'M4 21V10M20 21V10', 'M3.3 10h1.4M19.3 10h1.4', 'M2 21h20'],
  // Temple of Heaven / pagoda
  pagoda: ['M12 2.5V4', 'M7.5 7L12 4l4.5 3z', 'M9 7v2h6V7', 'M5.5 12L12 9l6.5 3z', 'M7.5 12v2.5h9V12', 'M4 17.5l8-3 8 3z', 'M6 17.5V21h12v-3.5', 'M3 21h18'],
  // One Pillar Pagoda, Hanoi
  onePillar: ['M12 5V3', 'M6 9l6-4 6 4z', 'M8 9h8v4H8z', 'M12 13v5', 'M3 19c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0'],
  // Pyramids of Giza
  pyramids: ['M2 21l7.5-12L17 21', 'M13.5 15.5L16 12l6 9', 'M17.5 5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0', 'M2 21h20'],
  // Christ the Redeemer
  christ: ['M10.8 4.2a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0', 'M5 7h14', 'M11 7h2l.6 8h-3.2z', 'M2 21c2-4 5-6 10-6s8 2 10 6'],
  // Sagrada Família
  sagrada: ['M5 21V11l1.5-5L8 11v10M10 21V9l2-6 2 6v12M16 21V11l1.5-5L19 11v10', 'M8 15h2M14 15h2', 'M3 21h18'],
  // Brandenburg Gate
  brandenburg: ['M10 6V4h4v2', 'M4 8V6h16v2', 'M3 8h18', 'M5 8v13M9.5 8v13M14.5 8v13M19 8v13', 'M3 21h18'],
  // Windmill
  windmill: ['M9 21l1.5-10h3L15 21', 'M7 4l10 10M17 4L7 14', 'M11 21v-2.5h2V21', 'M4 21h16'],
  // Parthenon
  parthenon: ['M3 8l9-4 9 4z', 'M3 10h18', 'M5 10v9M9.5 10v9M14.5 10v9M19 10v9', 'M3 19h18', 'M2 21h20'],
  // Mosque (Istanbul, Middle East, Maghreb)
  mosque: ['M12 9V6.5', 'M7 14c0-3 2.2-5 5-5s5 2 5 5z', 'M6 14h12v7H6z', 'M10.5 21v-3a1.5 1.5 0 0 1 3 0v3', 'M3.5 21V5M20.5 21V5', 'M2 21h20'],
  // St Basil's Cathedral
  basil: [
    'M12 3V2',
    'M12 3c-2 2-3 3-3 4.5S10.3 10 12 10s3-1 3-2.5S14 5 12 3z',
    'M6 9c-1.3 1.2-2 2-2 3s.9 1.5 2 1.5 2-.5 2-1.5-.7-1.8-2-3zM18 9c-1.3 1.2-2 2-2 3s.9 1.5 2 1.5 2-.5 2-1.5-.7-1.8-2-3z',
    'M10 10h4v11h-4zM4.5 13.5h3V21h-3zM16.5 13.5h3V21h-3z',
    'M2 21h20',
  ],
  // Angkor Wat
  angkor: ['M10 11V8l2-5 2 5v3', 'M5 13v-2l1.5-4L8 11v2M16 13v-2l1.5-4 1.5 4v2', 'M3 13h18v4H3z', 'M2 17h20v4H2z'],
  // Taipei 101
  taipei101: ['M12 2v2', 'M10 4h4l-.5 3h-3z', 'M9.5 7h5l-.5 3h-4zM9.5 10h5l-.5 3h-4zM9.5 13h5l-.5 3h-4z', 'M9 16h6v5H9z', 'M5 21h14'],
  // CN Tower / Sky Tower
  spireTower: ['M12 2v6', 'M9.5 8h5l-1 2h-3z', 'M11 10l-1 11M13 10l1 11', 'M5 21h14'],
  // Mesoamerican step pyramid
  stepPyramid: ['M4 21l2-3h12l2 3', 'M6 18l2-3h8l2 3', 'M8 15l2-3h4l2 3', 'M10.5 12V9.5h3V12', 'M11 21v-9M13 21v-9', 'M3 21h18'],
  // Machu Picchu
  machuPicchu: ['M2 21l6-10 3 4 4-9 7 15', 'M5 18h4M13 18h5M14 15h3', 'M2 21h20'],
  // Matterhorn / Alps
  alps: ['M2 21l7-9 2 2 3-10 8 17', 'M12.4 8.5L14 4l1.7 3.5-1.5 1-1.8 0', 'M2 21h20'],
  // Monas, Jakarta
  monas: ['M12 2c-.8 1-1 1.8 0 3 1-1.2.8-2 0-3z', 'M11 5h2', 'M11 5l-.5 11h3L13 5', 'M7 16h10l2 5H5z'],
  // Obelisco, Buenos Aires
  obelisk: ['M12 3l1.2 2 .6 16h-3.6l.6-16z', 'M6 21h12'],
  // Table Mountain
  tableMountain: ['M2 21l4-9h12l4 9', 'M6 12l1.5-1h9l1.5 1', 'M2 21h20'],
  // Castle (Lisbon, Prague, Edinburgh …)
  castle: ['M8 21V9h8v12', 'M8 9V7h1.5v2M11.25 9V7h1.5v2M14.5 9V7H16v2', 'M4 21v-7h4M20 21v-7h-4', 'M4 14v-1.5h1.5V14M18.5 14v-1.5H20V14', 'M10.5 21v-3a1.5 1.5 0 0 1 3 0v3', 'M2 21h20'],
  // Gabled canal houses (Copenhagen, Brussels, Stockholm …)
  gables: ['M3 21V11l3-3 3 3v10M9 21V9l3-3 3 3v12M15 21V12l3-3 3 3v9', 'M5.5 14h1M11.5 12h1M17.5 15h1', 'M2 21h20'],
  // Generic skyline (fallback, Hong Kong)
  city: ['M3 21V12h3v9M7 21V7h4v14M12 21V4l3 3v14M16 21V10h5v11', 'M8.5 10h1M8.5 13h1M17.5 13h2', 'M2 21h20'],
  heart: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'],
};

const BY_COUNTRY: Record<string, string> = {
  JP: 'tokyoTower',
  FR: 'eiffel',
  IT: 'colosseum',
  KR: 'namsan',
  TH: 'prang',
  MM: 'stupa',
  LA: 'stupa',
  LK: 'stupa',
  NP: 'stupa',
  BT: 'stupa',
  GB: 'bigBen',
  US: 'liberty',
  AU: 'opera',
  SG: 'mbs',
  MY: 'petronas',
  AE: 'burj',
  IN: 'taj',
  CN: 'pagoda',
  VN: 'onePillar',
  EG: 'pyramids',
  BR: 'christ',
  ES: 'sagrada',
  DE: 'brandenburg',
  NL: 'windmill',
  GR: 'parthenon',
  TR: 'mosque',
  SA: 'mosque',
  QA: 'mosque',
  OM: 'mosque',
  IR: 'mosque',
  MA: 'mosque',
  UZ: 'mosque',
  RU: 'basil',
  KH: 'angkor',
  TW: 'taipei101',
  CA: 'spireTower',
  NZ: 'spireTower',
  MX: 'stepPyramid',
  GT: 'stepPyramid',
  PE: 'machuPicchu',
  CH: 'alps',
  AT: 'alps',
  ID: 'monas',
  AR: 'obelisk',
  ZA: 'tableMountain',
  PT: 'castle',
  CZ: 'castle',
  HU: 'castle',
  IE: 'castle',
  DK: 'gables',
  BE: 'gables',
  SE: 'gables',
  NO: 'gables',
  HK: 'city',
};

export function landmarkFor(countryCode: string): string {
  return BY_COUNTRY[countryCode.toUpperCase()] ?? 'city';
}

export function Landmark({
  countryCode,
  name,
  size = 28,
  ...rest
}: { countryCode?: string; name?: string; size?: number } & SVGProps<SVGSVGElement>) {
  const key = name ?? landmarkFor(countryCode ?? '');
  const paths = SHAPES[key] ?? SHAPES.city;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-landmark={key}
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/** For previews / tests. */
export const LANDMARK_NAMES = Object.keys(SHAPES);
