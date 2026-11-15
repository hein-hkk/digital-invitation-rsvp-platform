import { Pinyon_Script } from "next/font/google";

// Script accent for Host Display Names in the curated wedding theme. It is
// declared here, not in the root layout, so Admin routes never preload it.
export const weddingScript = Pinyon_Script({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-wedding-script",
  display: "swap",
});
