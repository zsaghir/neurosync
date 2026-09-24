import { useFocusEffect } from "@react-navigation/native";
import { useRouter, type Href } from "expo-router";
import { useCallback, useRef } from "react";

/**
 * Returns a `push` that ignores repeat taps until this screen is focused again,
 * so a double tap cannot stack two copies of the next screen.
 */
export function useSingleNavigation() {
  const router = useRouter();
  const isNavigating = useRef(false);

  useFocusEffect(
    useCallback(() => {
      isNavigating.current = false;
    }, []),
  );

  return useCallback(
    (href: Href) => {
      if (isNavigating.current) return;
      isNavigating.current = true;
      router.push(href);
    },
    [router],
  );
}
