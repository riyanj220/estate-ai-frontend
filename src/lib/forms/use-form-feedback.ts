"use client";

import { useEffect, useRef, useState } from "react";
import { focusFirstError } from "./focus-first-error";

/**
 * The announcement, notice and error-summary focus handling shared by the registration forms: one polite live
 * region, a notice that takes focus, and a summary that takes focus.
 */
export function useFormFeedback() {
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState("");
  const [summaryTick, setSummaryTick] = useState(0);
  const [noticeTick, setNoticeTick] = useState(0);
  const [errorTick, setErrorTick] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (summaryTick > 0) summaryRef.current?.focus();
  }, [summaryTick]);

  useEffect(() => {
    if (errorTick > 0) focusFirstError(summaryRef.current);
  }, [errorTick]);

  useEffect(() => {
    if (noticeTick > 0) noticeRef.current?.focus();
  }, [noticeTick]);

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Clearing first makes a repeated identical message announce again. Only the latest message is scheduled.
  function announce(message: string) {
    clearTimeout(timer.current);
    setAnnouncement("");
    timer.current = setTimeout(() => setAnnouncement(message), 50);
  }

  // Drops a pending announcement and clears the live region.
  function resetAnnouncement() {
    clearTimeout(timer.current);
    setAnnouncement("");
  }

  function showNotice(message: string) {
    setNotice(message);
    setNoticeTick((tick) => tick + 1);
    announce(message);
  }

  return {
    announcement,
    setAnnouncement,
    resetAnnouncement,
    announce,
    notice,
    setNotice,
    showNotice,
    focusSummary: () => setSummaryTick((tick) => tick + 1),
    focusErrors: () => setErrorTick((tick) => tick + 1),
    summaryRef,
    noticeRef,
  };
}
