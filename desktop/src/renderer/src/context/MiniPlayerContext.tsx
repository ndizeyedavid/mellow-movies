import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";

export interface MiniSession {
  item: {
    id: string;
    title: string;
    poster?: string;
    type?: string;
  };
  pick: { season: number; episode: number };
  srcs: string[];
  labels: string[];
  captions: Array<{ lang: string; label: string; src: string }>;
  position: number;
}

interface MiniPlayerContextValue {
  session: MiniSession | null;
  setSession: (s: MiniSession | null) => void;
  updatePosition: (pos: number) => void;
  clear: () => void;
}

const Ctx = createContext<MiniPlayerContextValue | null>(null);

export function MiniPlayerProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<MiniSession | null>(null);
  const sessionRef = useRef<MiniSession | null>(null);
  sessionRef.current = session;

  const setSession = useCallback((s: MiniSession | null) => {
    setSessionState(s);
  }, []);

  const updatePosition = useCallback((pos: number) => {
    setSessionState((prev) => (prev ? { ...prev, position: pos } : prev));
  }, []);

  const clear = useCallback(() => setSessionState(null), []);

  return (
    <Ctx.Provider value={{ session, setSession, updatePosition, clear }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMiniPlayer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMiniPlayer must be used within MiniPlayerProvider");
  return v;
}
