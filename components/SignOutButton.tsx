import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import { useClerk } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Alert, Platform, Pressable, StyleSheet, Text } from "react-native";

export const SignOutButton = () => {
  const { colors } = useAppTheme();
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
    <Pressable
      accessibilityLabel="Sign out"
      accessibilityRole="button"
      onPress={handleSignOut}
      style={styles.target}
    >
      <Text style={[styles.text, { color: colors.accent }]}>Sign out</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  target: {
    justifyContent: "center",
    minHeight: design.touchTarget,
  },
  text: {
    fontSize: design.type.meta + 1,
    fontWeight: "700",
  },
});
