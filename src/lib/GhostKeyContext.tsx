import { createContext, useContext, ReactNode } from "react";
import { useGhostKeyStore } from "@/lib/store";

type GhostKeyContextType = ReturnType<typeof useGhostKeyStore>;

const GhostKeyContext = createContext<GhostKeyContextType | null>(null);

export function GhostKeyProvider({ children }: { children: ReactNode }) {
  const store = useGhostKeyStore();
  return <GhostKeyContext.Provider value={store}>{children}</GhostKeyContext.Provider>;
}

export function useGhostKey() {
  const ctx = useContext(GhostKeyContext);
  if (!ctx) throw new Error("useGhostKey must be used within GhostKeyProvider");
  return ctx;
}
