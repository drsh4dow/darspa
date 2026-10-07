import { Effect, Match } from "effect";
import { ExamProblem } from "../../../shared/api";
import type { ExamOrder } from "../../../shared/examOrder";
import { request } from "../../lib/api";

export function requestExamOrder(patient: ExamOrder) {
  return request((api) =>
    api.public.examOrder({ payload: patient }).pipe(
      Effect.map(({ pdf, email }) => ({
        pdf: new Blob([Uint8Array.from(pdf)], { type: "application/pdf" }),
        email,
      })),
      Effect.catchTag(["ExamProblem", "RateLimited", "Unavailable"], (problem) => {
        const fields = Match.value(problem).pipe(
          Match.tag("ExamProblem", (error) => error.fields),
          Match.orElse(() => []),
        );

        return Effect.succeed({ problem: new ExamProblem({ message: problem.message, fields }) });
      }),
    ),
  );
}
