import { Effect, ManagedRuntime, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import {
  emailOutcome,
  examOrder,
  examProblem,
  fieldError,
  type ExamOrder,
} from "../../../shared/examOrder";

const runtime = ManagedRuntime.make(FetchHttpClient.layer);

export class ExamSubmissionError extends Schema.TaggedError<ExamSubmissionError>()(
  "ExamSubmissionError",
  {
    message: Schema.String,
    fields: Schema.Array(fieldError),
  },
) {}

const submit = Effect.fnUntraced(function* (patient: ExamOrder) {
  // Convex HTTP actions use the paired .site origin, including local development.
  const origin = import.meta.env.VITE_CONVEX_URL?.replace(/\.convex\.cloud$/, ".convex.site");
  const client = yield* HttpClient.HttpClient;
  const input = yield* Schema.encodeEffect(examOrder)(patient);

  const response = yield* HttpClientRequest.post(`${origin}/api/exam-orders`).pipe(
    HttpClientRequest.bodyJson(input),
    Effect.flatMap(client.execute),
  );

  if (response.status !== 200) {
    const problem = yield* HttpClientResponse.schemaBodyJson(examProblem)(response);

    return yield* new ExamSubmissionError(problem);
  }

  const email = yield* Schema.decodeUnknownEffect(emailOutcome)(response.headers["x-exam-email"]);
  const bytes = yield* response.arrayBuffer;

  return { pdf: new Blob([bytes], { type: "application/pdf" }), email };
});

export function requestExamOrder(patient: ExamOrder) {
  return runtime.runPromise(
    submit(patient).pipe(
      Effect.catchTag("ExamSubmissionError", (problem) => Effect.succeed({ problem })),
    ),
  );
}
