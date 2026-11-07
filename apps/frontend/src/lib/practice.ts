import axios from "axios";
import { BACKEND_URL } from "./config";

const API = `${BACKEND_URL}/api/v2/practice`;

// ---------- Types (match apps/backend/practice.ts) ----------

export type Context = { targetRole: string; profile: string; job: string | null };

export type Verdict = "strong_match" | "partial_match" | "mismatch" | "not_enough_info";

export type FitReport = {
    candidateSummary: string;
    candidateProfile: string;
    targetRole: string;
    verdict: Verdict;
    matchScore: number;
    verdictReason: string;
    strengths: string[];
    gaps: string[];
    cvAdvice: string[];
    practiceFocus: string[];
};

export type Question = {
    question: string;
    topic: string;
    kind: "technical" | "behavioral" | "project" | "system_design";
    lookingFor: string;
};

export type Feedback = {
    score: number;
    strengths: string[];
    weaknesses: string[];
    betterAnswer: string;
    tip: string;
};

/** What the AI decided the candidate's message was. Only "answer" is scored. */
export type MessageKind = "answer" | "clarification" | "hint_request" | "skip";

/** One message in the back-and-forth on a question (clarifications, hints, the final answer). */
export type Exchange = { from: "candidate" | "interviewer"; text: string };

export type Reply = {
    kind: MessageKind;
    reply: string;
    feedback: Feedback | null;
    modelAnswer: string | null;
};

/** A finished question: either answered (and scored) or skipped. */
export type Turn = {
    question: string;
    source: "ai" | "own";
    lookingFor?: string;
    /** Clarifications/hints before the final answer or skip. Missing in older sessions. */
    messages?: Exchange[];
    /** Missing in older sessions, which only had answered turns. */
    outcome?: "answered" | "skipped";
    answer: string;
    feedback?: Feedback;
    modelAnswer?: string;
};

export const isAnswered = (t: Turn): t is Turn & { feedback: Feedback } =>
    (t.outcome ?? "answered") === "answered" && !!t.feedback;

export type Summary = {
    overallScore: number;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    nextSteps: string[];
};

export type Session = {
    context: Context;
    report: FitReport;
    sources: { github: boolean; cv: boolean; job: boolean };
    turns: Turn[];
    summary?: Summary;
    /** Last chosen practice mode, so a page refresh doesn't ask again. */
    mode?: "ai" | "own";
};

// ---------- API ----------

export async function analyze(body: {
    github?: string;
    cvFile?: { name: string; base64: string };
    cvText?: string;
    jobText?: string;
}) {
    const { data } = await axios.post<Omit<Session, "turns">>(`${API}/analyze`, body);
    return data;
}

export async function nextQuestion(context: Context, focus: string[], history: Turn[]) {
    const { data } = await axios.post<Question>(`${API}/question`, {
        context,
        focus,
        history: history.map((t) => ({
            question: t.question,
            answer: t.outcome === "skipped" ? "(skipped)" : t.answer,
        })),
    });
    return data;
}

/** Sends the candidate's message. The AI decides if it's an answer, a question back, a hint request or a skip. */
export async function respond(
    context: Context,
    question: string,
    message: string,
    thread: Exchange[],
    kind?: "hint_request" | "skip",
) {
    const { data } = await axios.post<Reply>(`${API}/evaluate`, { context, question, answer: message, thread, kind });
    return data;
}

/** Only answered questions are sent; skipped ones have no score. */
export async function summarize(context: Context, turns: Turn[]) {
    const { data } = await axios.post<Summary>(`${API}/summary`, {
        context,
        items: turns.filter(isAnswered).map((t) => ({ question: t.question, answer: t.answer, score: t.feedback.score })),
    });
    return data;
}

/** Turns an axios error into the backend's message, if it sent one. */
export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again.") {
    if (axios.isAxiosError(e)) {
        const msg = (e.response?.data as { message?: string } | undefined)?.message;
        if (msg) return msg;
        if (!e.response) return "Can't reach the backend. Is it running on port 3001?";
    }
    return fallback;
}

// ---------- Session storage (survives a page refresh, cleared when the tab closes) ----------

const KEY = "practice-session";

export function loadSession(): Session | null {
    try {
        const raw = sessionStorage.getItem(KEY);
        return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
        return null;
    }
}

export function saveSession(session: Session) {
    try {
        sessionStorage.setItem(KEY, JSON.stringify(session));
    } catch {
        // Storage full or blocked: the app still works for this page view.
    }
}
