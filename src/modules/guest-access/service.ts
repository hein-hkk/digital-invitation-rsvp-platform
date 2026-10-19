import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  HERO_IMAGE_BUCKET,
  HERO_IMAGE_SIGNED_READ_SECONDS,
  isEventHeroImagePath,
} from "@/modules/hero-image/validation";
import { getGuestRsvpPermission } from "@/modules/rsvp/domain";
import {
  isInvitationToken,
  loadInvitationTokenConfig,
  tokenLookupHash,
  type InvitationTokenConfig,
} from "@/server/security/invitation-credentials";
import { createServiceRoleSupabaseClient } from "@/server/supabase/service-role";
import { productionClock, type Clock } from "@/server/time/clock";
import type { Database } from "@/types/database.types";

export type GuestInvitationView = {
  inviteeName: string;
  maximumPartySize: number;
  event: {
    hostDisplayNames: string[];
    eventDate: string;
    startTime: string;
    endTime: string | null;
    eventTimezone: string;
    venueName: string;
    venueAddress: string;
    venueMapUrl: string | null;
    dressCode: string | null;
    invitationMessage: string | null;
    venueArrivalNotes: string | null;
    organizerContactInformation: string | null;
    heroImageSignedUrl: string | null;
    rsvpDeadlineLocal: string | null;
  };
  rsvp: {
    status: "awaiting_response" | "attending" | "declined";
    attendeeCount: number;
    attendeeNames: string[];
    dietaryRequirements: string | null;
    guestMessage: string | null;
    respondedAt: string | null;
    updatedAt: string | null;
  };
  permission: { canEditRsvp: boolean };
};

export type GuestResolution =
  | { ok: true; value: GuestInvitationView }
  | {
      ok: false;
      error: {
        code: "INVITATION_UNAVAILABLE";
        message: string;
      };
    };

const unavailable: GuestResolution = {
  ok: false,
  error: {
    code: "INVITATION_UNAVAILABLE",
    message: "This invitation link is not available.",
  },
};

function safeMapUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function createGuestAccessService(context: {
  client: SupabaseClient<Database>;
  clock: Clock;
  tokenConfig: InvitationTokenConfig;
}) {
  const { client, clock, tokenConfig } = context;
  return {
    async resolveGuestInvitation(rawToken: string): Promise<GuestResolution> {
      if (!isInvitationToken(rawToken)) return unavailable;
      const lookupHash = `\\x${tokenLookupHash(rawToken, tokenConfig).toString("hex")}`;
      const credentialResult = await client
        .from("invitation_access_credentials")
        .select("invitation_id")
        .eq("token_lookup_hash", lookupHash)
        .maybeSingle();
      if (credentialResult.error) throw new Error("Guest access unavailable");
      const credential = credentialResult.data;
      if (!credential) return unavailable;

      const invitationResult = await client
        .from("invitations")
        .select("event_id,invitee_name,maximum_party_size,revoked_at")
        .eq("id", credential.invitation_id)
        .maybeSingle();
      if (invitationResult.error) throw new Error("Guest access unavailable");
      const invitation = invitationResult.data;
      if (!invitation || invitation.revoked_at !== null) return unavailable;

      const eventResult = await client
        .from("events")
        .select(
          "publication_status,event_date,start_time,end_time,event_timezone,host_display_names,venue_name,venue_address,venue_map_url,dress_code,invitation_message,venue_arrival_notes,organizer_contact_information,rsvp_deadline_local,hero_image_storage_path",
        )
        .eq("id", invitation.event_id)
        .maybeSingle();
      if (eventResult.error) throw new Error("Guest access unavailable");
      const event = eventResult.data;
      if (!event) return unavailable;
      const permission = getGuestRsvpPermission(
        {
          publicationStatus: event.publication_status,
          eventDate: event.event_date,
          endTime: event.end_time,
          eventTimezone: event.event_timezone,
          rsvpDeadlineLocal: event.rsvp_deadline_local,
        },
        { isCurrentToken: true, revokedAt: invitation.revoked_at },
        clock,
      );
      if (!permission.canReadInvitation) return unavailable;
      if (
        !event.event_date ||
        !event.start_time ||
        !event.event_timezone ||
        !event.venue_name ||
        !event.venue_address
      ) {
        throw new Error("Guest access unavailable");
      }

      const rsvpResult = await client
        .from("rsvps")
        .select(
          "status,attendee_count,attendee_names,dietary_requirements,guest_message,responded_at,response_updated_at",
        )
        .eq("invitation_id", credential.invitation_id)
        .maybeSingle();
      if (rsvpResult.error || !rsvpResult.data)
        throw new Error("Guest access unavailable");
      const rsvp = rsvpResult.data;
      let heroImageSignedUrl: string | null = null;
      if (
        event.hero_image_storage_path &&
        isEventHeroImagePath(invitation.event_id, event.hero_image_storage_path)
      ) {
        try {
          const signed = await client.storage
            .from(HERO_IMAGE_BUCKET)
            .createSignedUrl(
              event.hero_image_storage_path,
              HERO_IMAGE_SIGNED_READ_SECONDS,
            );
          if (!signed.error) heroImageSignedUrl = signed.data.signedUrl;
        } catch {
          // Optional media must not prevent Event details or RSVP access.
        }
      }
      return {
        ok: true,
        value: {
          inviteeName: invitation.invitee_name,
          maximumPartySize: invitation.maximum_party_size,
          event: {
            hostDisplayNames: event.host_display_names,
            eventDate: event.event_date,
            startTime: event.start_time,
            endTime: event.end_time,
            eventTimezone: event.event_timezone,
            venueName: event.venue_name,
            venueAddress: event.venue_address,
            venueMapUrl: safeMapUrl(event.venue_map_url),
            dressCode: event.dress_code,
            invitationMessage: event.invitation_message,
            venueArrivalNotes: event.venue_arrival_notes,
            organizerContactInformation: event.organizer_contact_information,
            heroImageSignedUrl,
            rsvpDeadlineLocal: event.rsvp_deadline_local,
          },
          rsvp: {
            status: rsvp.status,
            attendeeCount: rsvp.attendee_count,
            attendeeNames: rsvp.attendee_names,
            dietaryRequirements: rsvp.dietary_requirements,
            guestMessage: rsvp.guest_message,
            respondedAt: rsvp.responded_at,
            updatedAt: rsvp.response_updated_at,
          },
          permission: { canEditRsvp: permission.canEditRsvp },
        },
      };
    },
  };
}

export async function resolveGuestInvitation(rawToken: string) {
  return createGuestAccessService({
    client: createServiceRoleSupabaseClient(),
    clock: productionClock,
    tokenConfig: loadInvitationTokenConfig(),
  }).resolveGuestInvitation(rawToken);
}
