import { createClient } from "@sanity/client";

console.log("token:", process.env.EXPO_PUBLIC_SANITY_WRITE_TOKEN);

export const sanityClient = createClient({
  projectId: "w9srkdut",
  dataset: "production",
  apiVersion: "2024-03-05",
  useCdn: false,
  token: process.env.EXPO_PUBLIC_SANITY_WRITE_TOKEN,
});
