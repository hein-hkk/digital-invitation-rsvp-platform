export type GuestRsvpFormState = {
  kind: "idle" | "invalid" | "conflict";
  message: string | null;
  fieldErrors: Record<string, string>;
};

export const initialGuestRsvpFormState: GuestRsvpFormState = {
  kind: "idle",
  message: null,
  fieldErrors: {},
};
