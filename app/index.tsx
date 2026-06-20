import { SignOutButton } from "@/components/SignOutButton";
import { useAuth } from "@clerk/clerk-expo";
import OpenAI from "openai";
import { StyleSheet, Text, View } from "react-native";

const client = new OpenAI({
  apiKey: process.env.API_KEY,
});
const response = await client.responses.create({
  model: "gpt-5.5",
  input: "Explain HTTP in one sentence",
});
console.log(response.output_text);
// use
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
