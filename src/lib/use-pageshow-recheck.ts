"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { getApi } from "@/lib/api";
import { withTimeout } from "@/lib/forms";
import { useSession } from "@/lib/session";

/**
 * A page restored from the back-forward cache keeps what it showed, possibly for an account that has since signed out. On
 * such a restore (`pageshow` with `persisted`) the session is checked again: a session that is gone goes to `signInPath`,
 * anything else calls `onRestore` (reload the content, reset a frozen form).
 */
export function usePageshowRecheck(signInPath: string, onRestore: () => void) {
  const router = useRouter();
  const { refresh } = useSession();
  const restore = useRef(onRestore);
  const path = useRef(signInPath);
  useEffect(() => {
    restore.current = onRestore;
    path.current = signInPath;
  });
  useEffect(() => {
    const onShow = async (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      try {
        const api = await getApi();
        const { response } = await withTimeout((signal) => api.GET("/api/v1/me", { cache: "no-store", signal }));
        if (response.status === 401) {
          await refresh();
          router.replace(path.current);
          return;
        }
        refresh().catch(() => undefined);
      } catch {
        // The check could not run: fall through and reload what the page shows.
      }
      restore.current();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [refresh, router]);
}
