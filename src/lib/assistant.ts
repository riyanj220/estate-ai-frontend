import type { components } from "@/api/schema";
import { detailLabel } from "@/lib/listing-details";
import { choiceLabel, formatArea } from "@/lib/listing-labels";

/** Reading the assistant's answers and the fixed sentences shown for them. AI text is only ever shown as plain text. */
export type AssistantTurn = components["schemas"]["AssistantTurn"];
export type AssistantSession = components["schemas"]["AssistantSession"];
export type AssistantNextStep = components["schemas"]["AssistantNextStep"];
export type AssistantApplied = components["schemas"]["AssistantApplied"];
export type TurnOutcome = components["schemas"]["AssistantTurnResult"]["outcome"];

export const MAX_MESSAGE = 2000;
/** Retrieval and the model may together take about 32 seconds. */
export const TURN_TIMEOUT_MS = 40_000;

export const FAILED_OUTCOME_MESSAGES: Record<Exclude<TurnOutcome, "success">, string> = {
  fallback: "The assistant is unavailable right now. Try again later, or continue with the manual form.",
  error: "The assistant is unavailable right now. Try again, or continue with the manual form.",
  timeout: "The assistant took too long. Try again, or continue with the manual form.",
  budget_exhausted: "Today's AI capacity is used up. Continue with the manual form or try again tomorrow.",
};
export const NO_EXPLANATIONS = "Explanations are unavailable right now, so this reply has no sources.";
export const KNOWLEDGE_NOTICE = "General information only. It does not verify any approval, title or possession.";
export const SAVED_HEADING = "Saved to your draft. Please check these in the form:";
/** Fields whose value is the Seller's own words: shown exactly as stored. */
const FREE_TEXT = ["title", "society", "phase", "sector", "block"];

/** "Bedrooms: 5", for a value the assistant saved. Plain text only. */
export function appliedText({ field, value }: AssistantApplied): string {
  const name = detailLabel(field);
  if (typeof value === "boolean") return `${name}: ${value ? "Yes" : "No"}`;
  const text = String(value ?? "");
  if (FREE_TEXT.includes(field) || field === "marla_basis") return `${name}: ${text}`;
  if (typeof value === "string" && /^\d+(\.\d+)?$/.test(text)) return `${name}: ${formatArea(text)}`;
  return `${name}: ${typeof value === "string" && /^[a-z_]+$/.test(text) ? choiceLabel(field, text) : text}`;
}
export const MESSAGE_REQUIRED = "Type a message first.";
export const MESSAGE_REFUSED = "Write a message of up to 2,000 characters in plain text.";
export const SEND_CONFLICT = "Your message was not sent. Another message may still be in progress, or this listing is no longer a draft.";
export const NOT_A_DRAFT = "The assistant is only available while a listing is a draft.";
export const ASSISTANT_FORBIDDEN = "Your account cannot use the assistant right now.";

const isTurn = (value: unknown): value is AssistantTurn => {
  const turn = value as Partial<AssistantTurn> | null;
  return (
    typeof turn === "object" &&
    turn !== null &&
    typeof turn.id === "string" &&
    typeof turn.message === "string" &&
    typeof turn.reply === "string" &&
    Array.isArray(turn.sources) &&
    Array.isArray(turn.applied) &&
    turn.applied.every((item) => typeof item?.field === "string") &&
    Array.isArray(turn.notices) &&
    turn.notices.every((notice) => typeof notice === "string") &&
    turn.sources.every((source) => typeof source?.title === "string" && typeof source?.source === "string")
  );
};

export function readTurn(value: unknown): AssistantTurn | null {
  return isTurn(value) ? value : null;
}

export function readNextStep(value: unknown): AssistantNextStep | null {
  const step = value as Partial<AssistantNextStep> | null | undefined;
  return step && typeof step.question === "string" && (step.kind === "required" || step.kind === "review") ? (step as AssistantNextStep) : null;
}

export function readSession(value: unknown): AssistantSession | null {
  const session = value as Partial<AssistantSession> | null;
  if (typeof session !== "object" || session === null || typeof session.id !== "string") return null;
  return Array.isArray(session.turns) && session.turns.every(isTurn) ? (session as AssistantSession) : null;
}
