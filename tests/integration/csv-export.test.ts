import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createExportOperations } from "@/modules/exports/service";
import {
  createInvitationCredential,
  invitationUrl,
} from "@/server/security/invitation-credentials";
import {
  cleanupOrganizers,
  createDraftEvent,
  createInvitation,
  createOrganizer,
  serviceClient,
} from "../helpers/local-supabase";

describe("M11 CSV export against local Supabase", () => {
  it("includes every Invitation across pages and excludes credentials and IDs", async () => {
    const owner = await createOrganizer();
    try {
      const eventId = await createDraftEvent(owner, {
        owner_user_id: owner.id,
        event_title: "Synthetic Export Event",
      });
      const tokenConfig = {
        hashKey: randomBytes(32),
        encryptionKey: randomBytes(32),
        keyVersion: 1 as const,
        baseUrl: "https://example.test",
      };
      const credential = createInvitationCredential(tokenConfig);
      const attendingRecord = await serviceClient().rpc(
        "create_invitation_record",
        {
          p_owner_user_id: owner.id,
          p_event_id: eventId,
          p_invitee_name: "=Attending Household",
          p_maximum_party_size: 3,
          p_token_lookup_hash: `\\x${credential.lookupHash.toString("hex")}`,
          p_token_ciphertext: credential.ciphertext,
          p_token_key_version: credential.keyVersion,
        },
      );
      if (attendingRecord.error || !attendingRecord.data) {
        throw attendingRecord.error;
      }
      const attendingId = attendingRecord.data;
      const declinedId = await createInvitation(
        owner,
        eventId,
        "Declined Household",
        2,
      );
      const awaitingId = await createInvitation(
        owner,
        eventId,
        "Awaiting Household",
        4,
      );
      const attending = await serviceClient()
        .from("rsvps")
        .update({
          status: "attending",
          attendee_count: 2,
          attendee_names: ["=Alex", "Sam"],
          dietary_requirements: "  +Vegetarian",
          guest_message: "@See you there",
        })
        .eq("invitation_id", attendingId);
      expect(attending.error).toBeNull();
      const declined = await serviceClient()
        .from("rsvps")
        .update({ status: "declined", guest_message: "Thanks" })
        .eq("invitation_id", declinedId);
      expect(declined.error).toBeNull();
      const revoked = await serviceClient()
        .from("invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", awaitingId);
      expect(revoked.error).toBeNull();

      // Two rows per request proves the export reads beyond its first page.
      const result = await createExportOperations({
        client: owner.client,
        organizerId: owner.id,
        pageSize: 2,
      }).exportEventCsv(eventId);
      expect(result.filename).toBe("synthetic-export-event-rsvp.csv");
      const lines = result.csv.trimEnd().split("\r\n");
      expect(lines).toHaveLength(4);
      expect(lines[0]).toBe(
        "Invitee Name,RSVP Status,Maximum Party Size,Attendee Count,Attendee Names,Dietary Requirements,Guest Message,Responded At,Updated At",
      );
      expect(result.csv).toContain(
        "'=Attending Household,Attending,3,2,'=Alex; Sam,'  +Vegetarian,'@See you there",
      );
      expect(result.csv).toContain("Declined Household,Declined,2,0,,,Thanks");
      expect(result.csv).toContain(
        "Awaiting Household,Awaiting Response,4,0,,,,,",
      );
      const storedCredential = await serviceClient()
        .from("invitation_access_credentials")
        .select("token_lookup_hash,token_ciphertext")
        .eq("invitation_id", attendingId)
        .single();
      expect(storedCredential.error).toBeNull();
      for (const forbidden of [
        eventId,
        attendingId,
        declinedId,
        awaitingId,
        credential.rawToken,
        invitationUrl(credential.rawToken, tokenConfig),
        storedCredential.data!.token_lookup_hash,
        storedCredential.data!.token_ciphertext,
        "token_lookup_hash",
        "token_ciphertext",
        "/i/",
      ]) {
        expect(result.csv).not.toContain(forbidden);
      }
    } finally {
      await cleanupOrganizers([owner]);
    }
  });

  it("allows an Ended Event export and denies another Organizer or a false Event ID", async () => {
    const owner = await createOrganizer();
    const stranger = await createOrganizer();
    try {
      const event = await serviceClient()
        .from("events")
        .insert({
          owner_user_id: owner.id,
          event_title: "Past Synthetic Event",
          publication_status: "published",
          published_at: new Date().toISOString(),
          event_type: "wedding",
          host_display_names: ["Synthetic Host"],
          event_date: "2099-11-29",
          start_time: "18:00",
          end_time: "21:00",
          event_timezone: "Asia/Bangkok",
          venue_name: "Synthetic Venue",
          venue_address: "Synthetic Address",
        })
        .select("id")
        .single();
      if (event.error || !event.data) throw event.error;
      const eventId = event.data.id;
      const invitationId = await createInvitation(
        owner,
        eventId,
        `Past Household ${randomUUID()}`,
      );
      const endEvent = await serviceClient()
        .from("events")
        .update({ event_date: "2000-01-01" })
        .eq("id", eventId);
      expect(endEvent.error).toBeNull();
      const ownedExport = createExportOperations({
        client: owner.client,
        organizerId: owner.id,
      });
      const foreignExport = createExportOperations({
        client: stranger.client,
        organizerId: stranger.id,
      });
      const endedCsv = (await ownedExport.exportEventCsv(eventId)).csv;
      expect(endedCsv).toContain("Invitee Name,RSVP Status");
      expect(endedCsv).toContain("Past Household");
      expect(endedCsv).not.toContain(invitationId);
      await expect(foreignExport.exportEventCsv(eventId)).rejects.toMatchObject(
        {
          code: "EVENT_NOT_FOUND",
        },
      );
      await expect(
        ownedExport.exportEventCsv(randomUUID()),
      ).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
      });
      await expect(ownedExport.exportEventCsv("invalid")).rejects.toMatchObject(
        {
          code: "EVENT_NOT_FOUND",
        },
      );
    } finally {
      await cleanupOrganizers([owner, stranger]);
    }
  });
});
