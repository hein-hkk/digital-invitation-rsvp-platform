"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createActionAuthClient } from "@/server/auth/session";
import { allowOrganizerOtp } from "@/server/rate-limit";

const emailSchema = z.email().max(254);
const otpSchema = z.string().regex(/^\d{6}$/);

export type RequestOtpState = {
  status: "idle" | "sent" | "error" | "throttled" | "unavailable";
  email: string;
};
export type VerifyOtpState = { status: "idle" | "error" };

export async function requestOrganizerOtp(
  _state: RequestOtpState,
  form: FormData,
): Promise<RequestOtpState> {
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { status: "error", email: "" };

  try {
    if (!(await allowOrganizerOtp(email.data))) {
      return { status: "throttled", email: email.data };
    }
  } catch {
    return { status: "unavailable", email: email.data };
  }

  try {
    const client = await createActionAuthClient();
    await client.auth.signInWithOtp({
      email: email.data,
      options: { shouldCreateUser: false },
    });
  } catch {
    // Keep account existence and provider details out of public responses.
  }
  return { status: "sent", email: email.data };
}

export async function verifyOrganizerOtp(
  _state: VerifyOtpState,
  form: FormData,
): Promise<VerifyOtpState> {
  const email = emailSchema.safeParse(form.get("email"));
  const token = otpSchema.safeParse(form.get("token"));
  if (!email.success || !token.success) return { status: "error" };

  try {
    const client = await createActionAuthClient();
    const result = await client.auth.verifyOtp({
      email: email.data,
      token: token.data,
      type: "email",
    });
    if (result.error || !result.data.session) return { status: "error" };
  } catch {
    return { status: "error" };
  }
  redirect("/admin");
}

export async function signOutOrganizer() {
  const client = await createActionAuthClient();
  await client.auth.signOut({ scope: "local" });
  redirect("/admin/sign-in");
}
