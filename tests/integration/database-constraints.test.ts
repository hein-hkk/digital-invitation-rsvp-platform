import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanupOrganizers,
  createDraftEvent,
  createInvitation,
  createOrganizer,
  serviceClient,
  syntheticHash,
  type OrganizerFixture,
} from "../helpers/local-supabase";

let organizer: OrganizerFixture;
let draftEventId: string;
let invitationId: string;

beforeEach(async () => {
  organizer = await createOrganizer();
  draftEventId = await createDraftEvent(organizer);
  invitationId = await createInvitation(
    organizer,
    draftEventId,
    `Fixture ${randomUUID()}`,
    3,
  );
});

afterEach(async () => {
  if (organizer) await cleanupOrganizers([organizer]);
});

describe("migrated schema and controlled operations", () => {
  it("allows incomplete Drafts but rejects incomplete publication and invalid timing", async () => {
    const incomplete = await organizer.client.rpc("publish_event", {
      p_event_id: draftEventId,
    });
    expect(incomplete.error).not.toBeNull();

    const invalidTime = await organizer.client
      .from("events")
      .update({
        event_date: "2099-11-20",
        start_time: "18:00",
        end_time: "18:00",
      })
      .eq("id", draftEventId);
    expect(invalidTime.error).not.toBeNull();

    const invalidDeadline = await organizer.client
      .from("events")
      .update({
        event_date: "2099-11-20",
        start_time: "18:00",
        rsvp_deadline_local: "2099-11-20T18:00:00",
      })
      .eq("id", draftEventId);
    expect(invalidDeadline.error).not.toBeNull();

    const valid = await organizer.client
      .from("events")
      .update({
        event_type: "wedding",
        event_title: "Synthetic test Event",
        host_display_names: ["A", "B"],
        event_date: "2099-11-20",
        start_time: "18:00",
        end_time: "22:00",
        event_timezone: "Invalid/Timezone",
        venue_name: "Test venue",
        venue_address: "Test address",
      })
      .eq("id", draftEventId);
    expect(valid.error).toBeNull();
    expect(
      (
        await organizer.client.rpc("publish_event", {
          p_event_id: draftEventId,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await organizer.client
          .from("events")
          .update({ event_timezone: "Asia/Bangkok" })
          .eq("id", draftEventId)
      ).error,
    ).toBeNull();
    const publish = await organizer.client.rpc("publish_event", {
      p_event_id: draftEventId,
    });
    expect(publish.error).toBeNull();
    const published = await organizer.client
      .from("events")
      .select("publication_status,published_at")
      .eq("id", draftEventId)
      .single();
    expect(published.data?.publication_status).toBe("published");
    expect(published.data?.published_at).not.toBeNull();
  });

  it("enforces Maximum Party Size, credential shape/uniqueness, and atomic creation", async () => {
    const invalidParent = await serviceClient().from("invitations").insert({
      event_id: randomUUID(),
      invitee_name: "No parent",
      maximum_party_size: 2,
    });
    expect(invalidParent.error).not.toBeNull();

    for (const size of [0, 21]) {
      const invalid = await serviceClient().rpc("create_invitation_record", {
        p_owner_user_id: organizer.id,
        p_event_id: draftEventId,
        p_invitee_name: `Invalid ${randomUUID()}`,
        p_maximum_party_size: size,
        p_token_lookup_hash: syntheticHash(randomUUID()),
        p_token_ciphertext: "synthetic-test-envelope",
        p_token_key_version: 1,
      });
      expect(invalid.error).not.toBeNull();
    }
    const malformedHash = await serviceClient().rpc(
      "create_invitation_record",
      {
        p_owner_user_id: organizer.id,
        p_event_id: draftEventId,
        p_invitee_name: "Malformed hash",
        p_maximum_party_size: 2,
        p_token_lookup_hash: "\\x01",
        p_token_ciphertext: "synthetic-test-envelope",
        p_token_key_version: 1,
      },
    );
    expect(malformedHash.error).not.toBeNull();

    const existing = await serviceClient()
      .from("invitation_access_credentials")
      .select("token_lookup_hash")
      .eq("invitation_id", invitationId)
      .single();
    expect(existing.error).toBeNull();
    const duplicate = await serviceClient().rpc("create_invitation_record", {
      p_owner_user_id: organizer.id,
      p_event_id: draftEventId,
      p_invitee_name: "Duplicate credential",
      p_maximum_party_size: 2,
      p_token_lookup_hash: existing.data!.token_lookup_hash,
      p_token_ciphertext: "synthetic-test-envelope",
      p_token_key_version: 1,
    });
    expect(duplicate.error).not.toBeNull();
    const partial = await serviceClient()
      .from("invitations")
      .select("id")
      .eq("invitee_name", "Duplicate credential");
    expect(partial.data).toEqual([]);

    const rsvp = await serviceClient()
      .from("rsvps")
      .select("status,attendee_count")
      .eq("invitation_id", invitationId)
      .single();
    expect(rsvp.data).toMatchObject({
      status: "awaiting_response",
      attendee_count: 0,
    });
  });

  it("replaces only the current credential and preserves the RSVP", async () => {
    const service = serviceClient();
    const old = await service
      .from("invitation_access_credentials")
      .select("token_lookup_hash")
      .eq("invitation_id", invitationId)
      .single();
    const nextHash = syntheticHash(randomUUID());
    const replacement = await service.rpc("replace_invitation_credential", {
      p_owner_user_id: organizer.id,
      p_invitation_id: invitationId,
      p_token_lookup_hash: nextHash,
      p_token_ciphertext: "synthetic-replacement-envelope",
      p_token_key_version: 2,
    });
    expect(replacement.error).toBeNull();
    const current = await service
      .from("invitation_access_credentials")
      .select("token_lookup_hash,token_key_version")
      .eq("invitation_id", invitationId)
      .single();
    expect(current.data).toMatchObject({
      token_lookup_hash: nextHash,
      token_key_version: 2,
    });
    expect(current.data?.token_lookup_hash).not.toBe(
      old.data?.token_lookup_hash,
    );
    expect(
      (
        await service
          .from("rsvps")
          .select("invitation_id")
          .eq("invitation_id", invitationId)
      ).data,
    ).toHaveLength(1);
  });

  it("prevents invalid RSVP structure and cross-table count conflicts", async () => {
    const service = serviceClient();
    for (const invalid of [
      { status: "attending" as const, attendee_count: 0 },
      { status: "attending" as const, attendee_count: 4 },
      {
        status: "attending" as const,
        attendee_count: 2,
        attendee_names: ["A", "B", "C"],
      },
      {
        status: "declined" as const,
        attendee_count: 0,
        dietary_requirements: "Vegetarian",
      },
    ]) {
      const result = await service
        .from("rsvps")
        .update(invalid)
        .eq("invitation_id", invitationId);
      expect(result.error).not.toBeNull();
    }
    const attending = await service
      .from("rsvps")
      .update({
        status: "attending",
        attendee_count: 3,
        attendee_names: ["A"],
      })
      .eq("invitation_id", invitationId);
    expect(attending.error).toBeNull();
    const shrink = await organizer.client
      .from("invitations")
      .update({ maximum_party_size: 2 })
      .eq("id", invitationId);
    expect(shrink.error).not.toBeNull();
    const current = await service
      .from("rsvps")
      .select("attendee_count,responded_at,response_updated_at")
      .eq("invitation_id", invitationId)
      .single();
    expect(current.data?.attendee_count).toBe(3);
    expect(current.data?.responded_at).not.toBeNull();
    expect(current.data?.response_updated_at).not.toBeNull();
  });

  it("keeps attendee count within Maximum Party Size under concurrent writes", async () => {
    const [response, shrink] = await Promise.all([
      serviceClient()
        .from("rsvps")
        .update({ status: "attending", attendee_count: 3 })
        .eq("invitation_id", invitationId),
      organizer.client
        .from("invitations")
        .update({ maximum_party_size: 2 })
        .eq("id", invitationId),
    ]);
    expect([response.error, shrink.error].filter(Boolean)).toHaveLength(1);
    const [invitation, rsvp] = await Promise.all([
      serviceClient()
        .from("invitations")
        .select("maximum_party_size")
        .eq("id", invitationId)
        .single(),
      serviceClient()
        .from("rsvps")
        .select("attendee_count")
        .eq("invitation_id", invitationId)
        .single(),
    ]);
    expect(rsvp.data!.attendee_count).toBeLessThanOrEqual(
      invitation.data!.maximum_party_size,
    );
  });

  it("preserves Guest Message through Declined cleanup and blocks Organizer edits", async () => {
    const service = serviceClient();
    const message = await service
      .from("rsvps")
      .update({
        status: "attending",
        attendee_count: 2,
        attendee_names: ["A"],
        dietary_requirements: "Vegetarian",
        guest_message: "Synthetic thank you",
      })
      .eq("invitation_id", invitationId);
    expect(message.error).toBeNull();
    const organizerEdit = await organizer.client
      .from("rsvps")
      .update({ guest_message: "Tampered" })
      .eq("invitation_id", invitationId);
    expect(organizerEdit.error).not.toBeNull();
    const declined = await organizer.client
      .from("rsvps")
      .update({
        status: "declined",
        attendee_count: 0,
        attendee_names: [],
        dietary_requirements: null,
      })
      .eq("invitation_id", invitationId);
    expect(declined.error).toBeNull();
    const current = await service
      .from("rsvps")
      .select(
        "status,attendee_count,attendee_names,dietary_requirements,guest_message",
      )
      .eq("invitation_id", invitationId)
      .single();
    expect(current.data).toMatchObject({
      status: "declined",
      attendee_count: 0,
      attendee_names: [],
      dietary_requirements: null,
      guest_message: "Synthetic thank you",
    });
  });

  it("rejects active Published deletion and cascades after an Ended Event is deleted", async () => {
    const service = serviceClient();
    const activeFields = await organizer.client
      .from("events")
      .update({
        event_type: "wedding",
        event_title: "Future synthetic Event",
        host_display_names: ["A"],
        event_date: "2099-11-20",
        start_time: "18:00",
        event_timezone: "Asia/Bangkok",
        venue_name: "Test venue",
        venue_address: "Test address",
      })
      .eq("id", draftEventId);
    expect(activeFields.error).toBeNull();
    expect(
      (
        await organizer.client.rpc("publish_event", {
          p_event_id: draftEventId,
        })
      ).error,
    ).toBeNull();
    const activeDelete = await organizer.client.rpc("delete_event_record", {
      p_event_id: draftEventId,
    });
    expect(activeDelete.error).not.toBeNull();

    const endedId = await createDraftEvent(organizer, {
      owner_user_id: organizer.id,
      event_type: "wedding",
      event_title: "Past synthetic Event",
      host_display_names: ["A"],
      event_date: "2000-01-01",
      start_time: "18:00",
      end_time: "22:00",
      event_timezone: "Asia/Bangkok",
      venue_name: "Test venue",
      venue_address: "Test address",
    });
    const endedInvitation = await createInvitation(
      organizer,
      endedId,
      `Past ${randomUUID()}`,
    );
    expect(
      (await organizer.client.rpc("publish_event", { p_event_id: endedId }))
        .error,
    ).toBeNull();
    const endedUpdate = await organizer.client
      .from("events")
      .update({ event_title: "Tampered" })
      .eq("id", endedId);
    expect(endedUpdate.error).not.toBeNull();
    expect(
      (
        await organizer.client.rpc("delete_event_record", {
          p_event_id: endedId,
        })
      ).error,
    ).toBeNull();

    expect(
      (await service.from("events").select("id").eq("id", endedId)).data,
    ).toEqual([]);
    expect(
      (await service.from("invitations").select("id").eq("id", endedInvitation))
        .data,
    ).toEqual([]);
    expect(
      (
        await service
          .from("rsvps")
          .select("invitation_id")
          .eq("invitation_id", endedInvitation)
      ).data,
    ).toEqual([]);
    expect(
      (
        await service
          .from("invitation_access_credentials")
          .select("invitation_id")
          .eq("invitation_id", endedInvitation)
      ).data,
    ).toEqual([]);
  });
});
