import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

/**
 * Refreshes a screen's cached data when the screen regains focus.
 *
 * This replaces "reload on every focus" with three rules:
 * - the first focus is skipped, because mounting the query already fetched;
 * - only stale data is refetched, so quick back-and-forth navigation is free;
 * - the refetch runs in the background. Cached data stays on screen and the
 *   query never goes back to its pending (spinner) state.
 */
export function useRefreshOnFocus(queryKey: QueryKey | null) {
  const queryClient = useQueryClient();
  const isFirstFocus = useRef(true);
  const serializedKey = queryKey ? JSON.stringify(queryKey) : null;

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (!serializedKey) return;

      void queryClient.refetchQueries({
        queryKey: JSON.parse(serializedKey) as QueryKey,
        type: "active",
        stale: true,
      });
    }, [queryClient, serializedKey]),
  );
}
