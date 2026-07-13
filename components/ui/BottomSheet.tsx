import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type BottomSheetProps = {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  visible: boolean;
};

export function BottomSheet({
  children,
  onClose,
  title,
  visible,
}: BottomSheetProps) {
  const { colors } = useAppTheme();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Pressable
          accessibilityLabel="Close sheet"
          onPress={onClose}
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" color={colors.textMuted} size={18} />
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    alignSelf: "center",
    borderTopLeftRadius: design.radius.lg,
    borderTopRightRadius: design.radius.lg,
    maxWidth: design.contentMaxWidth,
    paddingBottom: design.spacing.xxl,
    paddingHorizontal: design.spacing.lg,
    width: "100%",
  },
  handle: {
    alignSelf: "center",
    borderRadius: design.radius.pill,
    height: 4,
    marginBottom: design.spacing.sm,
    marginTop: design.spacing.sm,
    width: 34,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: design.spacing.md,
  },
  title: {
    fontSize: design.type.bodyLarge,
    fontWeight: "900",
  },
  closeButton: {
    alignItems: "center",
    height: design.touchTarget,
    justifyContent: "center",
    width: design.touchTarget,
  },
});
