import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonymousClient,
  cleanupOrganizers,
  createDraftEvent,
  createInvitation,
  createOrganizer,
  serviceClient,
  type OrganizerFixture,
} from "../helpers/local-supabase";

let organizerA: OrganizerFixture;
let organizerB: OrganizerFixture;
let eventA: string;
let eventB: string;
let invitationA: string;
let invitationB: string;

beforeAll(async () => {
  organizerA = await createOrganizer();
  organizerB = await createOrganizer();
  eventA = await createDraftEvent(organizerA);
  eventB = await createDraftEvent(organizerB);
  invitationA = await createInvitation(organizerA, eventA, "A household");
  invitationB = await createInvitation(organizerB, eventB, "B household");
});

afterAll(async () => {
  await cleanupOrganizers([organizerA, organizerB].filter(Boolean));
});

describe("RLS Organizer and anonymous isolation", () => {
  it("limits Events and ownership assignment", async () => {
    const read = await organizerA.client.from("events").select("id");
    expect(read.error).toBeNull();
    expect(read.data?.map((row) => row.id)).toContain(eventA);
    expect(read.data?.map((row) => row.id)).not.toContain(eventB);

    const ownUpdate = await organizerA.client
      .from("events")
      .update({ event_title: "Owned synthetic Event" })
      .eq("id", eventA);
    expect(ownUpdate.error).toBeNull();

    const foreignUpdate = await organizerA.client
      .from("events")
      .update({ event_title: "Tampered" })
      .eq("id", eventB)
      .select("id");
    expect(foreignUpdate.data).toEqual([]);
    const forgedInsert = await organizerA.client
      .from("events")
      .insert({ owner_user_id: organizerB.id });
    expect(forgedInsert.error).not.toBeNull();
  });

  it("limits Invitations and RSVPs through the owned Event", async () => {
    const invitations = await organizerA.client
      .from("invitations")
      .select("id");
    expect(invitations.error).toBeNull();
    expect(invitations.data?.map((row) => row.id)).toContain(invitationA);
    expect(invitations.data?.map((row) => row.id)).not.toContain(invitationB);

    const rsvps = await organizerA.client.from("rsvps").select("invitation_id");
    expect(rsvps.error).toBeNull();
    expect(rsvps.data?.map((row) => row.invitation_id)).toContain(invitationA);
    expect(rsvps.data?.map((row) => row.invitation_id)).not.toContain(
      invitationB,
    );

    const foreignUpdate = await organizerA.client
      .from("rsvps")
      .update({ status: "declined" })
      .eq("invitation_id", invitationB)
      .select("invitation_id");
    expect(foreignUpdate.data).toEqual([]);
  });

  it("denies credential reads and broad anonymous private-table access", async () => {
    for (const client of [organizerA.client, anonymousClient()]) {
      const credentials = await client
        .from("invitation_access_credentials")
        .select("invitation_id");
      expect(credentials.data ?? []).toEqual([]);
    }
    const anon = anonymousClient();
    for (const table of ["events", "invitations", "rsvps"] as const) {
      const result = await anon.from(table).select("*");
      expect(result.data ?? []).toEqual([]);
    }
    const privileged = await serviceClient()
      .from("invitation_access_credentials")
      .select("invitation_id")
      .eq("invitation_id", invitationA);
    expect(privileged.data).toHaveLength(1);

    const unauthorizedCreation = await organizerA.client.rpc(
      "create_invitation_record",
      {
        p_owner_user_id: organizerA.id,
        p_event_id: eventA,
        p_invitee_name: "Unauthorized direct creation",
        p_maximum_party_size: 2,
        p_token_lookup_hash: "\\x" + "00".repeat(32),
        p_token_ciphertext: "synthetic-envelope",
        p_token_key_version: 1,
      },
    );
    expect(unauthorizedCreation.error).not.toBeNull();
  });
});
