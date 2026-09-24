import {
  fetchUserSettings,
  updateUserSettings,
  type UserSettings,
  type UserSettingsUpdate,
} from "@/lib/api/settings";
import { queryKeys } from "@/lib/query/keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryScope } from "./use-query-scope";

/** User settings, shared by the app theme, the Tasks screen, and Settings. */
export function useUserSettings() {
  const { getToken, userId, scope } = useQueryScope();

  return useQuery({
    queryKey: queryKeys.settings(scope),
    queryFn: () => fetchUserSettings(getToken),
    enabled: userId != null,
  });
}

/** Saves settings and puts the server's copy in the cache, so the theme updates at once. */
export function useUpdateUserSettings() {
  const { getToken, scope } = useQueryScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UserSettingsUpdate) => updateUserSettings(getToken, input),
    onSuccess: (settings) => {
      queryClient.setQueryData<UserSettings>(queryKeys.settings(scope), settings);
    },
  });
}
