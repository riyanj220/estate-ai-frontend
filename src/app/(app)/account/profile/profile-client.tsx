"use client";

import { useState } from "react";
import type { components } from "@/api/schema";
import { getApi } from "@/lib/http/api";
import { withTimeout } from "@/lib/forms/forms";
import { readProfileImage } from "@/lib/account/profile-image";
import { nextStamp } from "@/lib/messaging/read-stamp";
import { ProfileLoadState, useProfileLoad, type ProfileFetch } from "@/lib/account/use-profile-load";
import { DetailsForm } from "./details-form";
import { EmailChangeForm } from "./email-change-form";
import { ProfileImageSection } from "./image-section";

export type Profile = components["schemas"]["Profile"];
/** A profile as read from the server, with the stamp its read took before it asked (see `read-stamp.ts`). */
type ProfileRead = Profile & { readStamp: number };

function readProfile(data: unknown): Profile | null {
  if (typeof data !== "object" || data === null) return null;
  const { full_name, phone, email, pending_email, image } = data as Record<string, unknown>;
  if (typeof full_name !== "string" || typeof phone !== "string" || typeof email !== "string") return null;
  if (pending_email !== null && typeof pending_email !== "string") return null;
  // Strict: a picture that is not exactly the documented shape (its URL the owner route) makes the whole answer unreadable.
  const picture = readProfileImage(image, "individual");
  return picture.ok ? { full_name, phone, email, pending_email, image: picture.image } : null;
}

async function fetchProfile(): Promise<ProfileFetch<ProfileRead>> {
  const readStamp = nextStamp(); // taken before the question: a picture change that finishes meanwhile is newer than this answer
  try {
    const api = await getApi();
    const { data, response } = await withTimeout((signal) => api.GET("/api/v1/me/profile", { signal }));
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

/** Loads the profile on the client (the page stays behind the server guard) and lays out the two independent forms. */
export function ProfileClient() {
  const { load, read, readDetailed, retry, sessionGone } = useProfileLoad(fetchProfile, "details-title");
  // The picture and the text form exclude each other: while one runs the other's action waits.
  const [imageBusy, setImageBusy] = useState(false);
  const [saving, setSaving] = useState(false);

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
      <ProfileImageSection
        kind="individual"
        image={load.profile.image}
        readStamp={load.profile.readStamp}
        locked={saving}
        onBusyChange={setImageBusy}
        reread={() => readDetailed(true)}
        onSessionGone={sessionGone}
      />
      <DetailsForm initial={load.profile} onSessionGone={sessionGone} onSaved={() => void read(true)} imageBusy={imageBusy} onPendingChange={setSaving} />
      <EmailChangeForm
        email={load.profile.email}
        pendingEmail={load.profile.pending_email}
        onRequested={() => read(true)}
        onSessionGone={sessionGone}
      />
    </>
  );
}
