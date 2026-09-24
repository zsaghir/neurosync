import { fetchCheckInInsights } from "@/lib/api/insights";
import { queryKeys } from "@/lib/query/keys";
import { useQuery } from "@tanstack/react-query";
import { useQueryScope } from "./use-query-scope";

export function useCheckInInsights() {
  const { getToken, userId, scope } = useQueryScope();

  return useQuery({
    queryKey: queryKeys.checkInInsights(scope),
    queryFn: () => fetchCheckInInsights(getToken),
    enabled: userId != null,
  });
}
