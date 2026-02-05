"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type ImageProvider = "fal" | "gemini" | "seedream";

interface ProviderContextValue {
  provider: ImageProvider;
  setProvider: (provider: ImageProvider) => void;
}

const ProviderContext = createContext<ProviderContextValue>({
  provider: "fal",
  setProvider: () => {},
});

const STORAGE_KEY = "ichigo-studio-provider";

export function ProviderProvider({ children }: { children: ReactNode }) {
  const [provider, setProviderState] = useState<ImageProvider>(() => {
    if (typeof window === "undefined") return "fal";
    return (localStorage.getItem(STORAGE_KEY) as ImageProvider) || "fal";
  });

  const setProvider = useCallback((p: ImageProvider) => {
    setProviderState(p);
    localStorage.setItem(STORAGE_KEY, p);
  }, []);

  return (
    <ProviderContext.Provider value={{ provider, setProvider }}>
      {children}
    </ProviderContext.Provider>
  );
}

export function useProvider() {
  return useContext(ProviderContext);
}
