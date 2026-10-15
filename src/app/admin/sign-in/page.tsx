import { redirect } from "next/navigation";
import { resolveOrganizerSession } from "@/server/auth/session";
import { OrganizerSignIn } from "@/components/auth/organizer-sign-in";

export default async function SignInPage() {
  if (await resolveOrganizerSession()) redirect("/admin");
  return <OrganizerSignIn />;
}
