import type { z } from "zod";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

type JsonSchema = Record<string, unknown>;

// Small helpers for writing JSON schemas in Groq's strict mode
// (every property required, no extra properties).
export const s = {
    str: (): JsonSchema => ({ type: "string" }),
    int: (): JsonSchema => ({ type: "integer" }),
    list: (items: JsonSchema = { type: "string" }): JsonSchema => ({ type: "array", items }),
    oneOf: (...values: string[]): JsonSchema => ({ type: "string", enum: values }),
    obj: (properties: Record<string, JsonSchema>): JsonSchema => ({
        type: "object",
        properties,
        required: Object.keys(properties),
        additionalProperties: false,
    }),
};

/** How long to wait after a 429, from the Retry-After header or the "try again in 2.4s" message. Max 20s. */
function retryDelayMs(header: string | null, body: string): number {
    const fromMessage = body.match(/try again in ([\d.]+)s/)?.[1];
    const seconds = Number(header ?? fromMessage ?? 5);
    return Math.min(Number.isFinite(seconds) ? seconds * 1000 + 500 : 5000, 20_000);
}

/** Calls the Groq model and returns a reply that is guaranteed to match `schema`. */
export async function groqJson<T>(opts: {
    name: string;
    system: string;
    user: string;
    jsonSchema: JsonSchema;
    schema: z.ZodType<T>;
    temperature?: number;
}): Promise<T> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error("GROQ_API_KEY is not set. Add it to apps/backend/.env");
    }

    let lastError: unknown;
    // Retries: the free tier has a tokens-per-minute limit (429), and the model
    // occasionally returns something that fails validation.
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetch(GROQ_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
                    temperature: opts.temperature ?? 0.4,
                    messages: [
                        { role: "system", content: opts.system },
                        { role: "user", content: opts.user },
                    ],
                    response_format: {
                        type: "json_schema",
                        json_schema: { name: opts.name, strict: true, schema: opts.jsonSchema },
                    },
                }),
            });

            if (response.status === 429 && attempt < 2) {
                await Bun.sleep(retryDelayMs(response.headers.get("retry-after"), await response.text()));
                continue;
            }
            if (!response.ok) {
                throw new Error(`Groq API error ${response.status}: ${await response.text()}`);
            }

            const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
            const content = data.choices?.[0]?.message?.content;
            if (!content) throw new Error("Groq returned an empty response");

            return opts.schema.parse(JSON.parse(content));
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError;
}
