import { SignOutButton } from "@/components/SignOutButton";
import { useAuth } from "@clerk/clerk-expo";
import { StyleSheet, Text, View } from "react-native";


export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>neurosync</Text>
      <Text style={styles.subtitle}>Sync all your thoughts</Text>
      {isLoaded && isSignedIn ? <SignOutButton /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
  elapsedTime: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 16,
  },
});
