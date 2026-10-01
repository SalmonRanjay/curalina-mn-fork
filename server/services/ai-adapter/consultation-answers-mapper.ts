/**
 * quizResponses row -> recommendation's `ConsultationAnswersIn` (ADR-0025).
 *
 * A pure structural mapping. Values are passed exactly as the quiz stores
 * them (`client/src/components/quiz/consultationOptions.ts`); recommendation
 * owns validation and answers `needs_input` for anything missing. The one
 * check made here is that every stored practical touch is a Consultation-1
 * option: an older quiz row can hold pre-Consultation feature strings, and
 * sending those would be a contract error (422) rather than an honest
 * `needs_input` for the customer.
 */

import type { QuizResponse } from "@shared/schema";
import type { ConsultationAnswersIn } from "./recommendation-client.js";

const CONSULTATION_TOUCHES = new Set([
  "Cozy, relaxing space for everyday comfort",
  "Pet friendly and durable fabrics",
  "Refined space for hosting and socializing",
  "Refined space for hosting guests",
  "Dedicated media area for television",
  "Storage to keep everything tidy",
  "An architectural fireplace to anchor the room",
]);

export type ConsultationAnswersResult =
  | { answers: ConsultationAnswersIn }
  | { needsInput: true; missingField: string };

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function toConsultationAnswers(quiz: QuizResponse): ConsultationAnswersResult {
  const touches = quiz.keyFeatures ?? [];
  if (touches.some((t) => !CONSULTATION_TOUCHES.has(t))) {
    return { needsInput: true, missingField: "keyFeatures" };
  }
  return {
    answers: {
      room_type: text(quiz.roomType),
      // The aesthetic step stores its persona as the single entry of `styles`.
      aesthetic: text(quiz.styles?.[0]),
      materiality: text(quiz.materiality),
      atmosphere: text(quiz.atmosphere),
      pattern_preference: text(quiz.patternPreference),
      practical_touches: touches,
      seating_capacity: quiz.seatingCapacity ?? null,
      bed_size: text(quiz.bedSize),
      investment: text(quiz.budgetRange),
    },
  };
}
