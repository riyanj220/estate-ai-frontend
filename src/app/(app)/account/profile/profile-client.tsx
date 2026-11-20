"use client";

import type { components } from "@/api/schema";
import { getApi } from "@/lib/api";
import { withTimeout } from "@/lib/forms";
import { ProfileLoadState, useProfileLoad, type ProfileFetch } from "@/lib/use-profile-load";
import { DetailsForm } from "./details-form";
import { EmailChangeForm } from "./email-change-form";

export type Profile = components["schemas"]["Profile"];

function readProfile(data: unknown): Profile | null {
  if (typeof data !== "object" || data === null) return null;
  const { full_name, phone, email, pending_email } = data as Record<string, unknown>;
  if (typeof full_name !== "string" || typeof phone !== "string" || typeof email !== "string") return null;
  if (pending_email !== null && typeof pending_email !== "string") return null;
  return { full_name, phone, email, pending_email };
}

async function fetchProfile(): Promise<ProfileFetch<Profile>> {
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/me/profile", { signal }));
    if (response.ok) {
      const profile = readProfile(data);
      return profile ? { kind: "ready", profile } : { kind: "error" };
    }
    if (response.status === 401) return "gone";
    return response.status === 403 ? { kind: "forbidden" } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

/** Loads the profile on the client (the page stays behind the server guard) and lays out the two independent forms. */
export function ProfileClient() {
  const { load, read, retry, sessionGone } = useProfileLoad(fetchProfile, "details-title");

  if (load.kind === "forbidden") {
    return (
      <p className="card" data-testid="profile-forbidden">
        Profile editing is available for individual accounts.
      </p>
    );
  }
  if (load.kind !== "ready") return <ProfileLoadState load={load} onRetry={retry} noun="profile" />;
  return (
    <>
      <DetailsForm initial={load.profile} onSessionGone={sessionGone} onSaved={() => void read(true)} />
      <EmailChangeForm
        email={load.profile.email}
        pendingEmail={load.profile.pending_email}
        onRequested={() => read(true)}
        onSessionGone={sessionGone}
      />
    </>
  );
}
