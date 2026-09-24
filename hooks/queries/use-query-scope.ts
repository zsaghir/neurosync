import { SIGNED_OUT_SCOPE } from "@/lib/query/keys";
import { useAuth } from "@clerk/clerk-expo";

/** The signed-in user that owns cached data, plus the token getter for requests. */
export function useQueryScope() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const signedInUserId = isLoaded && isSignedIn && userId ? userId : null;

  return {
    getToken,
    isAuthLoaded: isLoaded,
    isSignedIn: Boolean(isLoaded && isSignedIn),
    userId: signedInUserId,
    scope: signedInUserId ?? SIGNED_OUT_SCOPE,
  };
}
