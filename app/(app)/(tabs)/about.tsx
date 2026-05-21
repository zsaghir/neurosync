import { StyleSheet, Text, View } from "react-native";
export default function About() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>About Clarity Journal</Text>
      <Text style={styles.content}>
        Clarity Journal is a personal journaling app designed to help you think
        clearly and reflect on your thoughts and feelings. It provides a simple
        and intuitive interface for writing down your thoughts, setting goals,
        and tracking your progress over time.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  content: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
});
