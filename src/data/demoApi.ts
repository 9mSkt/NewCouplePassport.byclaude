/**
 * Demo / offline adapter: everything lives in this browser (localStorage + IndexedDB for photos).
 * Used automatically when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.
 * NOTE: secrets are obviously readable here — the real protection lives in Supabase RLS.
 */
import { DEFAULT_MISSIONS } from './defaults';
import {
  ApiError,
  PHOTO_LIMIT,
  stampColorFor,
  type Api,
  type Book,
  type Mission,
  type Photo,
  type Role,
  type Stamp,
  type Visit,
} from './types';
import { isCountryCode } from '../lib/countries';
import { missionCurrent } from '../lib/missions';

const KEY = 'cp.demo.v1';
const ROLE_KEY = 'cp.demo.role';

type DbBook = Omit<Book, 'partnerAPhoto' | 'partnerBPhoto'> & { photoA: string | null; photoB: string | null };
type DbStamp = Omit<Stamp, 'visits' | 'photoCount'>;
type DbPhoto = Omit<Photo, 'url'>;
type DbMission = Omit<Mission, 'message' | 'unlockedAt'>;

interface DemoState {
  book: DbBook;
  stamps: DbStamp[];
  visits: Visit[];
  photos: DbPhoto[];
  missions: DbMission[];
  secrets: Record<string, { message: string; unlockedAt: string | null }>;
}

const uid = () => crypto.randomUUID();

/* ---------- tiny IndexedDB blob store ---------- */
let dbp: Promise<IDBDatabase> | null = null;
function idb(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('cp-demo', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('blobs');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
async function blobOp<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction('blobs', mode).objectStore('blobs'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const putBlob = (path: string, b: Blob) => blobOp('readwrite', (s) => s.put(b, path));
const getBlob = (path: string) => blobOp<Blob | undefined>('readonly', (s) => s.get(path));
const delBlob = (path: string) => blobOp('readwrite', (s) => s.delete(path));
const clearBlobs = () => blobOp('readwrite', (s) => s.clear());

const urlCache = new Map<string, string>();
async function blobUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const hit = urlCache.get(path);
  if (hit) return hit;
  const b = await getBlob(path).catch(() => undefined);
  if (!b) return null;
  const url = URL.createObjectURL(b);
  urlCache.set(path, url);
  return url;
}
function dropUrl(path: string) {
  const u = urlCache.get(path);
  if (u) URL.revokeObjectURL(u);
  urlCache.delete(path);
}

/* ---------- seed ---------- */
function visit(stampId: string, city: string, date: string): Visit {
  return { id: uid(), stampId, city, method: 'gps', checkedInAt: `${date}T10:00:00.000Z`, localDate: date };
}

export function seedState(sample: boolean): DemoState {
  const bookId = uid();
  const book: DbBook = {
    id: bookId,
    partnerAName: 'MIN',
    partnerBName: 'TON',
    weddingDate: '2026-11-21',
    weddingPlace: 'Bangkok',
    weddingCountry: 'TH',
    issuedBy: 'เพื่อนรักของแก',
    issuerNote:
      'ขอให้เล่มนี้เต็มไปด้วยแสตมป์ และทุกหน้ามีแต่รอยยิ้มของสองคนนะ เดินทางไปด้วยกันให้ทั่วโลกเลย!',
    photoA: null,
    photoB: null,
  };
  const wedding: DbStamp = {
    id: uid(),
    countryCode: 'TH',
    color: 'red',
    isWedding: true,
    memo: '',
    firstVisitAt: `${book.weddingDate}T00:00:00.000Z`,
  };
  const stamps: DbStamp[] = [wedding];
  const visits: Visit[] = [visit(wedding.id, 'Bangkok', book.weddingDate)];

  if (sample) {
    const trips: [string, string, [string, string][]][] = [
      ['JP', 'ซากุระบานพอดี! กินราเมงทุกวัน', [['Tokyo', '2027-04-04'], ['Kyoto', '2027-04-11']]],
      ['KR', '', [['Seoul', '2027-12-10'], ['Busan', '2027-12-14']]],
      ['IT', '', [['Rome', '2028-06-02'], ['Florence', '2028-06-05']]],
      ['FR', '', [['Paris', '2028-09-18']]],
    ];
    trips.forEach(([cc, memo, vs], i) => {
      const s: DbStamp = {
        id: uid(),
        countryCode: cc,
        color: stampColorFor(i + 1),
        isWedding: false,
        memo,
        firstVisitAt: `${vs[0][1]}T10:00:00.000Z`,
      };
      stamps.push(s);
      vs.forEach(([city, date]) => visits.push(visit(s.id, city, date)));
    });
  }

  const missions: DbMission[] = DEFAULT_MISSIONS.map((m) => ({ ...m, id: uid() }));
  const secrets: DemoState['secrets'] = {};
  const msgs = [
    'ยินดีด้วยกับทริปแรกในฐานะสามีภรรยา! ไปไหนต่อดี? ชวนพวกเราด้วยนะ 💌',
    'ห้าประเทศแล้ว! เก่งมาก ทริปหน้าซื้อของฝากมาให้เพื่อนด้วยล่ะ',
    'สุขสันต์วันครบรอบ 1 ปี! ขอบคุณที่ยังรักกันเหมือนวันแรก ❤',
    'รอบโลกแล้วจริงๆ! พวกเราภูมิใจในตัวแกสองคนมาก',
  ];
  missions.forEach((m, i) => (secrets[m.id] = { message: msgs[i] ?? '', unlockedAt: null }));
  const state: DemoState = { book, stamps, visits, photos: [], missions, secrets };
  evaluate(state);
  return state;
}

/* ---------- state helpers ---------- */
function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    /* ignore */
  }
  const s = seedState(true);
  save(s);
  return s;
}
function save(s: DemoState) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function hydrate(s: DemoState): Stamp[] {
  return s.stamps.map((st) => ({
    ...st,
    visits: s.visits.filter((v) => v.stampId === st.id),
    photoCount: s.photos.filter((p) => p.stampId === st.id).length,
  }));
}

/** Server-side check_missions() equivalent. */
function evaluate(s: DemoState): string[] {
  const stamps = hydrate(s);
  const unlocked: string[] = [];
  for (const m of s.missions) {
    const sec = s.secrets[m.id];
    if (!sec || sec.unlockedAt) continue;
    if (missionCurrent(m.rule, stamps, s.book.weddingDate) >= m.target) {
      sec.unlockedAt = new Date().toISOString();
      unlocked.push(m.id);
    }
  }
  return unlocked;
}

export function demoRole(): Role {
  try {
    return localStorage.getItem(ROLE_KEY) === 'issuer' ? 'issuer' : 'couple';
  } catch {
    return 'couple';
  }
}
export function setDemoRole(r: Role) {
  localStorage.setItem(ROLE_KEY, r);
}
export async function resetDemo(sample: boolean) {
  urlCache.forEach((u) => URL.revokeObjectURL(u));
  urlCache.clear();
  await clearBlobs().catch(() => undefined);
  save(seedState(sample));
}

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60));

function requireCouple() {
  if (demoRole() !== 'couple') throw new ApiError('not_allowed');
}

export const demoApi: Api = {
  mode: 'demo',
  async getSession() {
    const role = demoRole();
    return { userId: `demo-${role}`, email: null };
  },
  onAuthChange() {
    return () => undefined;
  },
  async signIn() {},
  async signOut() {},

  async loadBook() {
    const s = load();
    const role = demoRole();
    const { photoA, photoB, ...rest } = s.book;
    const book: Book = {
      ...rest,
      // spec Q4 default: the issuer cannot see the couple's photos
      partnerAPhoto: role === 'couple' ? await blobUrl(photoA) : null,
      partnerBPhoto: role === 'couple' ? await blobUrl(photoB) : null,
    };
    return delay({ book, role });
  },
  async updateBook(_bookId, patch) {
    if (demoRole() !== 'issuer') throw new ApiError('not_allowed');
    const s = load();
    Object.assign(s.book, patch);
    const wed = s.stamps.find((x) => x.isWedding);
    if (wed && patch.weddingDate) {
      wed.firstVisitAt = `${patch.weddingDate}T00:00:00.000Z`;
      s.visits.filter((v) => v.stampId === wed.id).forEach((v) => (v.localDate = patch.weddingDate!));
    }
    save(s);
  },
  async setBookPhoto(bookId, slot, img) {
    requireCouple();
    const s = load();
    const path = `${bookId}/book/${slot}-${uid()}.${img.ext}`;
    await putBlob(path, img.blob);
    const old = slot === 'a' ? s.book.photoA : s.book.photoB;
    if (old) {
      dropUrl(old);
      await delBlob(old);
    }
    if (slot === 'a') s.book.photoA = path;
    else s.book.photoB = path;
    save(s);
  },

  async listStamps() {
    return delay(hydrate(load()));
  },
  async checkIn(_bookId, input) {
    requireCouple();
    const s = load();
    const cc = input.countryCode.toUpperCase();
    if (!isCountryCode(cc)) throw new ApiError('unknown', 'bad_country');
    let stamp = s.stamps.find((x) => x.countryCode === cc);
    let created = false;
    const now = new Date().toISOString();
    if (!stamp) {
      stamp = { id: uid(), countryCode: cc, color: stampColorFor(s.stamps.length), isWedding: false, memo: '', firstVisitAt: now };
      s.stamps.push(stamp);
      created = true;
    }
    s.visits.push({
      id: uid(),
      stampId: stamp.id,
      city: input.city?.trim() || null,
      method: input.method,
      checkedInAt: now,
      localDate: input.localDate,
    });
    const unlocked = evaluate(s);
    save(s);
    return delay({ stampId: stamp.id, created, unlocked });
  },
  async updateMemo(stampId, memo) {
    requireCouple();
    const s = load();
    const st = s.stamps.find((x) => x.id === stampId);
    if (!st) throw new ApiError('not_found');
    st.memo = memo;
    save(s);
  },
  async deleteStamp(_bookId, stampId) {
    requireCouple();
    const s = load();
    const st = s.stamps.find((x) => x.id === stampId);
    if (!st || st.isWedding) throw new ApiError('not_allowed');
    for (const p of s.photos.filter((x) => x.stampId === stampId)) {
      dropUrl(p.storagePath);
      await delBlob(p.storagePath);
    }
    s.photos = s.photos.filter((x) => x.stampId !== stampId);
    s.visits = s.visits.filter((x) => x.stampId !== stampId);
    s.stamps = s.stamps.filter((x) => x.id !== stampId);
    save(s);
  },

  async listPhotos(_bookId, stampId) {
    if (demoRole() !== 'couple') return [];
    const s = load();
    const rows = s.photos.filter((p) => p.stampId === stampId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const out: Photo[] = [];
    for (const p of rows) out.push({ ...p, url: (await blobUrl(p.storagePath)) ?? '' });
    return out;
  },
  async addPhoto(bookId, stampId, img, caption) {
    requireCouple();
    const s = load();
    if (s.photos.filter((p) => p.stampId === stampId).length >= PHOTO_LIMIT) throw new ApiError('photo_limit');
    const id = uid();
    const path = `${bookId}/${stampId}/${id}.${img.ext}`;
    await putBlob(path, img.blob);
    s.photos.push({
      id,
      stampId,
      storagePath: path,
      caption,
      width: img.width,
      height: img.height,
      bytes: img.bytes,
      createdAt: new Date().toISOString(),
    });
    save(s);
  },
  async updateCaption(photoId, caption) {
    requireCouple();
    const s = load();
    const p = s.photos.find((x) => x.id === photoId);
    if (p) p.caption = caption;
    save(s);
  },
  async deletePhoto(photo) {
    requireCouple();
    const s = load();
    s.photos = s.photos.filter((x) => x.id !== photo.id);
    save(s);
    dropUrl(photo.storagePath);
    await delBlob(photo.storagePath);
  },

  async listMissions() {
    const s = load();
    const role = demoRole();
    return delay(
      s.missions
        .map((m) => {
          const sec = s.secrets[m.id];
          const unlockedAt = sec?.unlockedAt ?? null;
          return { ...m, unlockedAt, message: role === 'issuer' || unlockedAt ? sec?.message ?? '' : null };
        })
        .sort((a, b) => a.sort - b.sort),
    );
  },
  async saveMission(_bookId, draft) {
    if (demoRole() !== 'issuer') throw new ApiError('not_allowed');
    const s = load();
    const { message, id, ...fields } = draft;
    if (id) {
      const m = s.missions.find((x) => x.id === id);
      if (!m) throw new ApiError('not_found');
      Object.assign(m, fields);
      s.secrets[id] = { message, unlockedAt: s.secrets[id]?.unlockedAt ?? null };
    } else {
      const nid = uid();
      s.missions.push({ ...fields, id: nid });
      s.secrets[nid] = { message, unlockedAt: null };
    }
    evaluate(s);
    save(s);
  },
  async deleteMission(missionId) {
    if (demoRole() !== 'issuer') throw new ApiError('not_allowed');
    const s = load();
    s.missions = s.missions.filter((m) => m.id !== missionId);
    delete s.secrets[missionId];
    save(s);
  },
};
