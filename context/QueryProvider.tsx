import { connectAppStateToQueryFocus, createQueryClient } from "@/lib/query/client";
import { useAuth } from "@clerk/clerk-expo";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";

/** Drops every cached resource when the signed-in account changes or signs out. */
function ClearCacheOnAccountChange({ client }: { client: QueryClient }) {
  const { isLoaded, userId } = useAuth();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) return;
    const current = userId ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== current) {
      client.clear();
    }
    previousUserId.current = current;
  }, [client, isLoaded, userId]);

  return null;
}

/**
 * One app-wide cache for server data. Screens read from it instead of each
 * owning a private copy, so opening a screen shows data another screen already
 * loaded, and refreshes happen in the background instead of via a spinner.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(createQueryClient);

  useEffect(() => connectAppStateToQueryFocus(), []);

  return (
    <QueryClientProvider client={client}>
      <ClearCacheOnAccountChange client={client} />
      {children}
    </QueryClientProvider>
  );
}
