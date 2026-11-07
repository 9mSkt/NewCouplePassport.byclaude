export type Role = 'couple' | 'issuer';
export type Accent = 'red' | 'pink' | 'mint' | 'butter' | 'sky';
export const ACCENTS: Accent[] = ['red', 'pink', 'mint', 'butter', 'sky'];

/** Colour given to the n-th stamp in a book (0 = wedding stamp). Mirrors check_in() in SQL. */
export function stampColorFor(index: number): Accent {
  return ACCENTS[index % ACCENTS.length];
}

export interface Book {
  id: string;
  partnerAName: string;
  partnerBName: string;
  /** YYYY-MM-DD */
  weddingDate: string;
  weddingPlace: string;
  /** ISO 3166-1 alpha-2 */
  weddingCountry: string;
  issuedBy: string;
  issuerNote: string;
  /** Displayable URL (signed / object URL) or null */
  partnerAPhoto: string | null;
  partnerBPhoto: string | null;
}

export type BookPatch = Partial<
  Pick<Book, 'partnerAName' | 'partnerBName' | 'weddingDate' | 'weddingPlace' | 'issuedBy' | 'issuerNote'>
>;

export interface Visit {
  id: string;
  stampId: string;
  city: string | null;
  method: 'gps' | 'manual';
  checkedInAt: string;
  /** Local calendar date of the check-in, YYYY-MM-DD */
  localDate: string;
}

export interface Stamp {
  id: string;
  countryCode: string;
  color: Accent;
  isWedding: boolean;
  memo: string;
  firstVisitAt: string;
  visits: Visit[];
  photoCount: number;
}

export interface Photo {
  id: string;
  stampId: string;
  url: string;
  storagePath: string;
  caption: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
}

export type MissionRule = 'first_trip' | 'stamps_count' | 'anniversary' | 'continents' | 'cities_count';
export const MISSION_RULES: MissionRule[] = ['first_trip', 'stamps_count', 'anniversary', 'continents', 'cities_count'];

export interface Mission {
  id: string;
  key: string;
  rule: MissionRule;
  target: number;
  titleTh: string;
  titleEn: string;
  descTh: string;
  descEn: string;
  icon: string;
  color: Accent;
  sort: number;
  /** Null while locked. Couples never receive the message of a locked mission. */
  unlockedAt: string | null;
  message: string | null;
}

export interface MissionDraft {
  id?: string;
  key: string;
  rule: MissionRule;
  target: number;
  titleTh: string;
  titleEn: string;
  descTh: string;
  descEn: string;
  icon: string;
  color: Accent;
  sort: number;
  message: string;
}

export interface CheckInInput {
  countryCode: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  method: 'gps' | 'manual';
  localDate: string;
}

export interface CheckInResult {
  stampId: string;
  created: boolean;
  /** Mission ids unlocked by this check-in */
  unlocked: string[];
}

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  ext: 'webp' | 'jpg';
}

export interface Session {
  userId: string;
  email: string | null;
}

export const PHOTO_LIMIT = 5;

export class ApiError extends Error {
  constructor(
    public code: 'photo_limit' | 'not_allowed' | 'not_found' | 'unsupported_image' | 'network' | 'unknown',
    message?: string,
  ) {
    super(message ?? code);
  }
}

export interface Api {
  mode: 'demo' | 'supabase';
  getSession(): Promise<Session | null>;
  onAuthChange(cb: (s: Session | null) => void): () => void;
  signIn(email: string): Promise<void>;
  signOut(): Promise<void>;

  loadBook(): Promise<{ book: Book; role: Role } | null>;
  updateBook(bookId: string, patch: BookPatch): Promise<void>;
  setBookPhoto(bookId: string, slot: 'a' | 'b', img: ProcessedImage): Promise<void>;

  listStamps(bookId: string): Promise<Stamp[]>;
  checkIn(bookId: string, input: CheckInInput): Promise<CheckInResult>;
  updateMemo(stampId: string, memo: string): Promise<void>;
  deleteStamp(bookId: string, stampId: string): Promise<void>;

  listPhotos(bookId: string, stampId: string): Promise<Photo[]>;
  addPhoto(bookId: string, stampId: string, img: ProcessedImage, caption: string): Promise<void>;
  updateCaption(photoId: string, caption: string): Promise<void>;
  deletePhoto(photo: Photo): Promise<void>;

  listMissions(bookId: string): Promise<Mission[]>;
  saveMission(bookId: string, draft: MissionDraft): Promise<void>;
  deleteMission(missionId: string): Promise<void>;
}
