"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

// Initialize the Convex client
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

// Hook to get or create a session ID for anonymous users
export function useSessionId(): string {
  return useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const storageKey = "ichigo-sprite-session-id";
    let sessionId = localStorage.getItem(storageKey);

    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem(storageKey, sessionId);
    }

    return sessionId;
  }, []);
}
