import { ModalProvider } from "@/context/ModalContext";
import { tamaguiConfig } from "@/tamagui.config";
import { ClerkProvider } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider } from "tamagui";

function tabIcon(
  activeName: keyof typeof Ionicons.glyphMap,
  inactiveName: keyof typeof Ionicons.glyphMap,
) {
  const TabIcon = ({ focused, color }: { focused: boolean; color: string }) => (
      <Ionicons
        name={focused ? activeName : inactiveName}
        size={24}
        color={color}
      />
    );

  TabIcon.displayName = "TabIcon";

  return TabIcon;
}

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  throw new Error("Missing Clerk publishable key");
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ClerkProvider publishableKey={publishableKey}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="purple">
          {/* ↑ TamaguiProvider MUST wrap ModalProvider */}
          <ModalProvider>
            {/* ↑ ModalProvider goes INSIDE because it uses Tamagui components */}
            <Tabs>
              <Tabs.Screen
                name="index"
                options={{
                  title: "Home",
                  headerShown: false,
                  tabBarIcon: tabIcon("home", "home-outline"),
                }}
              />
              <Tabs.Screen
                name="about"
                options={{
                  title: "About",
                  tabBarIcon: tabIcon(
                    "information-circle",
                    "information-circle-outline",
                  ),
                }}
              />
            </Tabs>
          </ModalProvider>
        </TamaguiProvider>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}
