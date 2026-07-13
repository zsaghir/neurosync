import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";

function TabDot({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View
      style={[
        styles.tabDot,
        { backgroundColor: focused ? color : "transparent" },
      ]}
    />
  );
}

export default function TabLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: [
          styles.tabBar,
          { backgroundColor: colors.background, borderTopColor: colors.border },
        ],
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: TabDot,
        }}
      />
      <Tabs.Screen
        name="Tasks"
        options={{
          title: "Tasks",
          tabBarIcon: TabDot,
        }}
      />
      <Tabs.Screen
        name="TimeMap"
        options={{
          title: "Time Map",
          tabBarIcon: TabDot,
        }}
      />
      <Tabs.Screen
        name="Settings"
        options={{
          title: "Settings",
          tabBarIcon: TabDot,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    height: 68,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: design.type.caption,
    fontWeight: "700",
  },
  tabDot: {
    borderRadius: design.radius.pill,
    height: 5,
    marginTop: 4,
    width: 5,
  },
});
