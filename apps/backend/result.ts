import { z } from "zod";
import { groqJson, s } from "./llm";

const outputSchema = z.object({
    feedback: z.string(),
    score: z.number().int().min(0).max(10),
});

export type InterviewResult = z.infer<typeof outputSchema>;

const SYSTEM_PROMPT = `
You are an expert interview evaluator. Evaluate the user's interview from the transcript.
Give them a score from 0 to 10 and clear, constructive feedback about their interview
(strengths, weaknesses, and how to improve).
`.trim();

export async function calculateResult(
    messages: { type: "Assistant" | "User"; message: string; createdAt: Date }[],
): Promise<InterviewResult> {
    return groqJson({
        name: "interview_result",
        system: SYSTEM_PROMPT,
        user: `Interview transcript:\n${JSON.stringify(messages)}`,
        jsonSchema: s.obj({ feedback: s.str(), score: s.int() }),
        schema: outputSchema,
    });
}
