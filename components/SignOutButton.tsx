import { useClerk } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Alert, Platform, Text } from "react-native";
import { Button } from "tamagui";

export const SignOutButton = () => {
  // Use `useClerk()` to access the `signOut()` function
  const { signOut } = useClerk();
  const router = useRouter();
  const handleSignOut = async () => {
    const confirmMessage =
      "This will sign you out of your account and you will need to sign in again.";

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `Are you sure you want to sign out?\n\n${confirmMessage}`,
      );

      if (!confirmed) return;

      await signOut();
      router.replace("/sign-in");
      return;
    }

    // Are you sure you want to sign out?
    Alert.alert("Are you sure you want to sign out?", confirmMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/sign-in");
        },
      },
    ]);
  };
  return (
    <Button theme="white" borderColor="white" onPress={handleSignOut}>
      <Text>Sign out</Text>
    </Button>
  );
};
