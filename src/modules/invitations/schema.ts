export type InvitationValues = {
  inviteeName: string;
  maximumPartySize: string;
};

export const emptyInvitationValues: InvitationValues = {
  inviteeName: "",
  maximumPartySize: "",
};

export function invitationValuesFromForm(form: FormData): InvitationValues {
  return {
    inviteeName: String(form.get("inviteeName") ?? ""),
    maximumPartySize: String(form.get("maximumPartySize") ?? ""),
  };
}

export function validateInvitationValues(values: InvitationValues) {
  const fieldErrors: Record<string, string> = {};
  const inviteeName = values.inviteeName.trim();
  if (!inviteeName) fieldErrors.inviteeName = "Invitee Name is required.";
  const sizeText = values.maximumPartySize.trim();
  const maximumPartySize = /^\d+$/.test(sizeText) ? Number(sizeText) : NaN;
  if (
    !Number.isInteger(maximumPartySize) ||
    maximumPartySize < 1 ||
    maximumPartySize > 20
  ) {
    fieldErrors.maximumPartySize =
      "Maximum Party Size must be a whole number from 1 to 20.";
  }
  return {
    fieldErrors,
    valid: Object.keys(fieldErrors).length === 0,
    inviteeName,
    maximumPartySize: fieldErrors.maximumPartySize ? null : maximumPartySize,
  };
}
