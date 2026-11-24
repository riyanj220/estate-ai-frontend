"use client";

import { useState } from "react";
import type { components } from "@/api/schema";
import { getApi } from "@/lib/api";
import { withTimeout } from "@/lib/forms";
import { readProfileImage, validAgencyIdentifiers } from "@/lib/profile-image";
import { nextStamp } from "@/lib/read-stamp";
import { ProfileLoadState, useProfileLoad, type ProfileFetch } from "@/lib/use-profile-load";
import { AgencyDetailsForm } from "./agency-details-form";
import { EmailChangeForm } from "./email-change-form";
import { ProfileImageSection } from "./image-section";

export type AgencyProfile = components["schemas"]["AgencyProfile"];
/** A profile as read from the server, with the stamp its read took before it asked (see `read-stamp.ts`). */
type AgencyProfileRead = AgencyProfile & { readStamp: number };

const STRING_FIELDS = ["agency_name", "description", "city_id", "business_phone", "office_address", "email", "verification_status"] as const;

// Strict on purpose: the OpenAPI schema declares every one of these fields as a string (only `pending_email` is
// nullable), so a null or missing value is an unreadable answer, not an empty field.
function readProfile(data: unknown): AgencyProfile | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  for (const name of STRING_FIELDS) if (typeof record[name] !== "string") return null;
  if (record.pending_email !== null && typeof record.pending_email !== "string") return null;
  // Strict: the logo must be exactly the documented shape (its URL the owner route), and the public identifiers well formed.
  if (!readProfileImage(record.image, "agency").ok || !validAgencyIdentifiers(record.agency_id, record.logo_url)) return null;
  return record as AgencyProfile;
}

async function fetchProfile(): Promise<ProfileFetch<AgencyProfileRead>> {
  const readStamp = nextStamp(); // taken before the question: a logo change that finishes meanwhile is newer than this answer
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/me/agency-profile", { signal }));
    if (response.ok) {
      const profile = readProfile(data);
      return profile ? { kind: "ready", profile: { ...profile, readStamp } } : { kind: "error" };
    }
    if (response.status === 401) return "gone";
    return response.status === 403 ? { kind: "forbidden" } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

/** The server's status shown as plain text; only a plain lower-case token is used, anything else is "Unknown". */
function verificationLabel(status: string): string {
  if (!/^[a-z][a-z_]{0,30}$/.test(status)) return "Unknown";
  const words = status.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Loads the business profile on the client (the page stays behind the server guard) and lays out the details and email forms. */
export function AgencyProfileClient() {
  const { load, read, readDetailed, retry, sessionGone } = useProfileLoad(fetchProfile, "details-title");
  // The logo and the text form exclude each other: while one runs the other's action waits.
  const [imageBusy, setImageBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  if (load.kind === "forbidden") {
    return (
      <p className="card" data-testid="profile-forbidden">
        Business profile editing is available for agency accounts.
      </p>
    );
  }
  if (load.kind !== "ready") return <ProfileLoadState load={load} onRetry={retry} noun="business profile" />;
  return (
    <>
      <p className="muted" data-testid="verification-status">
        Agency verification: {verificationLabel(load.profile.verification_status)}
      </p>
      <ProfileImageSection
        kind="agency"
        image={load.profile.image}
        readStamp={load.profile.readStamp}
        locked={saving}
        onBusyChange={setImageBusy}
        reread={() => readDetailed(true)}
        onSessionGone={sessionGone}
      />
      <AgencyDetailsForm initial={load.profile} onSessionGone={sessionGone} onSaved={() => void read(true)} imageBusy={imageBusy} onPendingChange={setSaving} />
      <EmailChangeForm
        email={load.profile.email}
        pendingEmail={load.profile.pending_email}
        onRequested={() => read(true)}
        onSessionGone={sessionGone}
      />
    </>
  );
}
