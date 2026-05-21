import SignInWithGoogle from "@/components/SignInWithGoogle";
import { isClerkAPIResponseError, useSignIn } from "@clerk/clerk-expo";
import { ClerkAPIResponseError } from "@clerk/types";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  Card,
  H1,
  Input,
  Label,
  Paragraph,
  ScrollView,
  Spacer,
  XStack,
  YStack,
} from "tamagui";

export default function Page() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const onSignInPress = async () => {
    if (!isLoaded) return;
    setIsLoading(true);
    setErrorMessage("");

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });

      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace("/");
      } else {
        console.error(JSON.stringify(signInAttempt, null, 2));
      }
    } catch (err) {
      const clerkError = isClerkAPIResponseError(err)
        ? (err as ClerkAPIResponseError)
        : null;

      setErrorMessage(
        clerkError?.errors[0]?.longMessage ||
          clerkError?.errors[0]?.message ||
          "Whoops an error occurred, please try again!",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
      <ScrollView flex={1} bg="$background" contentContainerStyle={{ flex: 1 }}>
        <YStack
          flex={1}
          p="$4"
          gap="$4"
          style={{ justifyContent: "center", minHeight: "100%" }}
        >
          <YStack gap="$2" style={{ alignItems: "center" }}>
            <H1 color="$color" style={{ textAlign: "center" }}>
              Welcome
            </H1>
            <Paragraph
              color="$color"
              opacity={0.7}
              style={{ textAlign: "center" }}
            >
              Sign in to clarity.journal to continue
            </Paragraph>
          </YStack>

          <Card padding="$4" gap="$2" backgroundColor="$background">
            <YStack gap="$2">
              <YStack gap="$2">
                <Label color="$color">Email Address</Label>
                <Input
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={emailAddress}
                  placeholder="Enter your email"
                  onChangeText={setEmailAddress}
                  borderColor="$borderColor"
                  focusStyle={{
                    borderColor: "$purple10",
                  }}
                />
              </YStack>

              <YStack gap="$2">
                <Label color="$color">Password</Label>
                <Input
                  secureTextEntry
                  value={password}
                  placeholder="Enter your password"
                  onChangeText={setPassword}
                  borderColor="$borderColor"
                  focusStyle={{
                    borderColor: "$purple10",
                  }}
                />
              </YStack>

              {errorMessage ? (
                <Paragraph color="red" size="$2">
                  {errorMessage}
                </Paragraph>
              ) : null}

              <Spacer size="$2" />

              <Button
                size="$4"
                bg="#904BFF"
                borderColor="#904BFF"
                onPress={onSignInPress}
                disabled={!isLoaded || isLoading}
                opacity={!isLoaded || isLoading ? 0.5 : 1}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>

              <SignInWithGoogle />
            </YStack>
          </Card>

          <XStack
            gap="$2"
            style={{ justifyContent: "center", alignItems: "center" }}
          >
            <Paragraph color="$color" opacity={0.7}>
              Don&apos;t have an account?
            </Paragraph>
            <Link href="/sign-up" asChild>
              <Button variant="outlined" size="$3" borderColor="#904BFF">
                Sign Up
              </Button>
            </Link>
          </XStack>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
