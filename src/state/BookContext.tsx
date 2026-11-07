import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../data/api';
import type { Book, Mission, Role, Stamp } from '../data/types';
import { sortStamps } from '../lib/missions';

interface BookState {
  book: Book;
  role: Role;
  stamps: Stamp[];
  missions: Mission[];
  reloadBook(): Promise<void>;
  reloadStamps(): Promise<void>;
  reloadMissions(): Promise<void>;
}

const Ctx = createContext<BookState | null>(null);

export function BookProvider({ book: initialBook, role, children }: { book: Book; role: Role; children: ReactNode }) {
  const [book, setBook] = useState(initialBook);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);

  const reloadStamps = useCallback(async () => {
    setStamps(sortStamps(await api.listStamps(initialBook.id)));
  }, [initialBook.id]);
  const reloadMissions = useCallback(async () => {
    setMissions(await api.listMissions(initialBook.id));
  }, [initialBook.id]);
  const reloadBook = useCallback(async () => {
    const r = await api.loadBook();
    if (r) setBook(r.book);
  }, []);

  useEffect(() => {
    reloadStamps().catch(console.error);
    reloadMissions().catch(console.error);
  }, [reloadStamps, reloadMissions]);

  return (
    <Ctx.Provider value={{ book, role, stamps, missions, reloadBook, reloadStamps, reloadMissions }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBook(): BookState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useBook outside provider');
  return v;
}
