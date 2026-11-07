import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ApiError,
  PHOTO_LIMIT,
  type Api,
  type Book,
  type Mission,
  type MissionRule,
  type Accent,
  type Photo,
  type Role,
  type Stamp,
} from './types';

const BUCKET = 'photos';
const SIGNED_TTL = 60 * 60; // 1 hour

/* Row shapes as stored in Postgres (snake_case). */
interface BookRow {
  id: string;
  partner_a_name: string;
  partner_b_name: string;
  wedding_date: string;
  wedding_place: string;
  wedding_country: string;
  issued_by: string;
  issuer_note: string;
  partner_a_photo: string | null;
  partner_b_photo: string | null;
}
interface VisitRow {
  id: string;
  stamp_id: string;
  city: string | null;
  method: 'gps' | 'manual';
  checked_in_at: string;
  local_date: string;
}
interface StampRow {
  id: string;
  country_code: string;
  color: Accent;
  is_wedding: boolean;
  memo: string | null;
  first_visit_at: string;
  visits: VisitRow[];
  photos: { count: number }[];
}
interface PhotoRow {
  id: string;
  stamp_id: string;
  storage_path: string;
  caption: string | null;
  width: number;
  height: number;
  bytes: number;
  created_at: string;
}
interface MissionRow {
  id: string;
  key: string;
  rule: MissionRule;
  target: number;
  title_th: string;
  title_en: string;
  desc_th: string;
  desc_en: string;
  icon: string;
  color: Accent;
  sort: number;
  mission_secrets: { message: string; unlocked_at: string | null } | { message: string; unlocked_at: string | null }[] | null;
}

function fail(error: { message: string; code?: string } | null): never {
  const msg = error?.message ?? 'unknown';
  if (msg.includes('photo_limit')) throw new ApiError('photo_limit', msg);
  if (error?.code === '42501' || msg.includes('not_allowed') || msg.includes('row-level security'))
    throw new ApiError('not_allowed', msg);
  if (msg.toLowerCase().includes('fetch')) throw new ApiError('network', msg);
  throw new ApiError('unknown', msg);
}

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  async function sign(paths: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const list = paths.filter(Boolean);
    if (!list.length) return out;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(list, SIGNED_TTL);
    if (error) return out; // issuer has no access to photos: just show placeholders
    for (const d of data ?? []) if (d.signedUrl && d.path) out.set(d.path, d.signedUrl);
    return out;
  }

  async function userId(): Promise<string> {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new ApiError('not_allowed');
    return id;
  }

  return {
    mode: 'supabase',

    async getSession() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      return u ? { userId: u.id, email: u.email ?? null } : null;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => {
        const u = session?.user;
        cb(u ? { userId: u.id, email: u.email ?? null } : null);
      });
      return () => data.subscription.unsubscribe();
    },
    async signIn(email) {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
      });
      if (error) fail(error);
    },
    async signOut() {
      await sb.auth.signOut();
    },

    async loadBook() {
      const uidv = await userId();
      const { data, error } = await sb
        .from('book_members')
        .select('role, books(*)')
        .eq('user_id', uidv)
        .order('role', { ascending: true }) // 'couple' before 'issuer'
        .limit(1)
        .maybeSingle();
      if (error) fail(error);
      if (!data) return null;
      const raw = (data as unknown as { role: Role; books: BookRow | BookRow[] | null }).books;
      const b = Array.isArray(raw) ? raw[0] : raw;
      if (!b) return null;
      const signed = await sign([b.partner_a_photo ?? '', b.partner_b_photo ?? '']);
      const book: Book = {
        id: b.id,
        partnerAName: b.partner_a_name,
        partnerBName: b.partner_b_name,
        weddingDate: b.wedding_date,
        weddingPlace: b.wedding_place,
        weddingCountry: b.wedding_country,
        issuedBy: b.issued_by,
        issuerNote: b.issuer_note,
        partnerAPhoto: b.partner_a_photo ? signed.get(b.partner_a_photo) ?? null : null,
        partnerBPhoto: b.partner_b_photo ? signed.get(b.partner_b_photo) ?? null : null,
      };
      return { book, role: (data as { role: Role }).role };
    },

    async updateBook(bookId, patch) {
      const row: Partial<BookRow> = {};
      if (patch.partnerAName !== undefined) row.partner_a_name = patch.partnerAName;
      if (patch.partnerBName !== undefined) row.partner_b_name = patch.partnerBName;
      if (patch.weddingDate !== undefined) row.wedding_date = patch.weddingDate;
      if (patch.weddingPlace !== undefined) row.wedding_place = patch.weddingPlace;
      if (patch.issuedBy !== undefined) row.issued_by = patch.issuedBy;
      if (patch.issuerNote !== undefined) row.issuer_note = patch.issuerNote;
      const { error } = await sb.from('books').update(row).eq('id', bookId);
      if (error) fail(error);
    },

    async setBookPhoto(bookId, slot, img) {
      const path = `${bookId}/book/${slot}-${crypto.randomUUID()}.${img.ext}`;
      const { data: cur } = await sb.from('books').select('partner_a_photo, partner_b_photo').eq('id', bookId).single();
      const up = await sb.storage.from(BUCKET).upload(path, img.blob, { contentType: img.blob.type, upsert: false });
      if (up.error) fail(up.error);
      const col = slot === 'a' ? 'partner_a_photo' : 'partner_b_photo';
      const { error } = await sb.from('books').update({ [col]: path }).eq('id', bookId);
      if (error) {
        await sb.storage.from(BUCKET).remove([path]);
        fail(error);
      }
      const old = (cur as Record<string, string | null> | null)?.[col];
      if (old) await sb.storage.from(BUCKET).remove([old]);
    },

    async listStamps(bookId) {
      const { data, error } = await sb
        .from('stamps')
        .select('id, country_code, color, is_wedding, memo, first_visit_at, visits(id, stamp_id, city, method, checked_in_at, local_date), photos(count)')
        .eq('book_id', bookId);
      if (error) fail(error);
      return ((data ?? []) as unknown as StampRow[]).map(
        (r): Stamp => ({
          id: r.id,
          countryCode: r.country_code,
          color: r.color,
          isWedding: r.is_wedding,
          memo: r.memo ?? '',
          firstVisitAt: r.first_visit_at,
          photoCount: r.photos?.[0]?.count ?? 0,
          visits: (r.visits ?? []).map((v) => ({
            id: v.id,
            stampId: v.stamp_id,
            city: v.city,
            method: v.method,
            checkedInAt: v.checked_in_at,
            localDate: v.local_date,
          })),
        }),
      );
    },

    async checkIn(bookId, input) {
      const { data, error } = await sb.rpc('check_in', {
        p_book: bookId,
        p_country: input.countryCode,
        p_city: input.city,
        p_lat: input.lat,
        p_lng: input.lng,
        p_method: input.method,
        p_local_date: input.localDate,
      });
      if (error) fail(error);
      const d = data as { stamp_id: string; created: boolean; unlocked: string[] };
      return { stampId: d.stamp_id, created: d.created, unlocked: d.unlocked ?? [] };
    },

    async updateMemo(stampId, memo) {
      const { error } = await sb.from('stamps').update({ memo }).eq('id', stampId);
      if (error) fail(error);
    },

    async deleteStamp(_bookId, stampId) {
      const { data: rows } = await sb.from('photos').select('storage_path').eq('stamp_id', stampId);
      const paths = (rows ?? []).map((r: { storage_path: string }) => r.storage_path);
      const { error } = await sb.from('stamps').delete().eq('id', stampId);
      if (error) fail(error);
      if (paths.length) await sb.storage.from(BUCKET).remove(paths);
    },

    async listPhotos(_bookId, stampId) {
      const { data, error } = await sb
        .from('photos')
        .select('id, stamp_id, storage_path, caption, width, height, bytes, created_at')
        .eq('stamp_id', stampId)
        .order('created_at');
      if (error) fail(error);
      const rows = (data ?? []) as PhotoRow[];
      const signed = await sign(rows.map((r) => r.storage_path));
      return rows.map(
        (r): Photo => ({
          id: r.id,
          stampId: r.stamp_id,
          storagePath: r.storage_path,
          url: signed.get(r.storage_path) ?? '',
          caption: r.caption ?? '',
          width: r.width,
          height: r.height,
          bytes: r.bytes,
          createdAt: r.created_at,
        }),
      );
    },

    async addPhoto(bookId, stampId, img, caption) {
      const { count } = await sb.from('photos').select('id', { count: 'exact', head: true }).eq('stamp_id', stampId);
      if ((count ?? 0) >= PHOTO_LIMIT) throw new ApiError('photo_limit');
      const id = crypto.randomUUID();
      const path = `${bookId}/${stampId}/${id}.${img.ext}`;
      const up = await sb.storage.from(BUCKET).upload(path, img.blob, { contentType: img.blob.type, upsert: false });
      if (up.error) fail(up.error);
      const { error } = await sb.from('photos').insert({
        id,
        stamp_id: stampId,
        storage_path: path,
        caption,
        width: img.width,
        height: img.height,
        bytes: img.bytes,
        uploaded_by: await userId(),
      });
      if (error) {
        await sb.storage.from(BUCKET).remove([path]);
        fail(error);
      }
    },

    async updateCaption(photoId, caption) {
      const { error } = await sb.from('photos').update({ caption }).eq('id', photoId);
      if (error) fail(error);
    },

    async deletePhoto(photo) {
      const { error } = await sb.from('photos').delete().eq('id', photo.id);
      if (error) fail(error);
      await sb.storage.from(BUCKET).remove([photo.storagePath]);
    },

    async listMissions(bookId) {
      const { data, error } = await sb
        .from('missions')
        .select('id, key, rule, target, title_th, title_en, desc_th, desc_en, icon, color, sort, mission_secrets(message, unlocked_at)')
        .eq('book_id', bookId)
        .order('sort');
      if (error) fail(error);
      return ((data ?? []) as unknown as MissionRow[]).map((r): Mission => {
        const sec = Array.isArray(r.mission_secrets) ? r.mission_secrets[0] : r.mission_secrets;
        return {
          id: r.id,
          key: r.key,
          rule: r.rule,
          target: r.target,
          titleTh: r.title_th,
          titleEn: r.title_en,
          descTh: r.desc_th,
          descEn: r.desc_en,
          icon: r.icon,
          color: r.color,
          sort: r.sort,
          unlockedAt: sec?.unlocked_at ?? null,
          message: sec?.message ?? null,
        };
      });
    },

    async saveMission(bookId, d) {
      const row = {
        book_id: bookId,
        key: d.key,
        rule: d.rule,
        target: d.target,
        title_th: d.titleTh,
        title_en: d.titleEn,
        desc_th: d.descTh,
        desc_en: d.descEn,
        icon: d.icon,
        color: d.color,
        sort: d.sort,
      };
      let id = d.id;
      if (id) {
        const { error } = await sb.from('missions').update(row).eq('id', id);
        if (error) fail(error);
      } else {
        const { data, error } = await sb.from('missions').insert(row).select('id').single();
        if (error) fail(error);
        id = (data as { id: string }).id;
      }
      const { error } = await sb.from('mission_secrets').upsert({ mission_id: id, message: d.message }, { onConflict: 'mission_id' });
      if (error) fail(error);
      await sb.rpc('check_missions', { p_book: bookId });
    },

    async deleteMission(missionId) {
      const { error } = await sb.from('missions').delete().eq('id', missionId);
      if (error) fail(error);
    },
  };
}
