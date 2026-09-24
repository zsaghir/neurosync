import { APIRequestError, AuthenticationError } from "@/lib/api/client";
import { QueryClient, focusManager } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

/** Auth failures and 4xx responses will not succeed on retry; network blips might. */
export const shouldRetryRequest = (failureCount: number, error: unknown) => {
  if (error instanceof AuthenticationError) return false;
  if (error instanceof APIRequestError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 2;
};

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Data younger than this is reused as-is when another screen asks for it,
        // so navigating back and forth does not refetch at all.
        staleTime: 30_000,
        retry: shouldRetryRequest,
      },
      mutations: {
        retry: false,
      },
    },
  });

/**
 * React Native has no browser "window focus" event. Map the app returning to
 * the foreground onto TanStack's focus signal so stale data refreshes then,
 * in the background, without clearing what is already on screen.
 */
export const connectAppStateToQueryFocus = () => {
  if (Platform.OS === "web") return () => {};

  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener("change", (state) => {
      handleFocus(state === "active");
    });
    return () => subscription.remove();
  });

  return () => focusManager.setEventListener(() => () => {});
};
