import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";
import {
    Bot,
    ChevronDown,
    Flag,
    Lightbulb,
    Loader2,
    MessageSquarePlus,
    Mic,
    MicOff,
    Send,
    SkipForward,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
    User,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { ScoreBadge, Steps } from "./shared";
import {
    errorMessage,
    isAnswered,
    loadSession,
    nextQuestion,
    respond,
    saveSession,
    summarize,
    type Exchange,
    type Feedback,
    type Session,
    type Turn,
} from "@/lib/practice";
import { cn } from "@/lib/utils";

type Mode = "ai" | "own";
/** The open question, plus any clarifications/hints exchanged on it so far. */
type Current = { question: string; source: Mode; lookingFor?: string; topic?: string; messages: Exchange[] };

const HINT_TEXT = "I'm not sure. Can I get a hint?";
const SKIP_TEXT = "Skip this question.";

// ---------- Speech-to-text (browser built-in; works in Chrome and Edge) ----------

function getRecognition(): any | null {
    const w = window as any;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    return Ctor ? new Ctor() : null;
}

function useSpeech(onFinal: (text: string) => void) {
    const [listening, setListening] = useState(false);
    const [interim, setInterim] = useState("");
    const recRef = useRef<any>(null);
    const supported = typeof window !== "undefined" && !!getRecognition();

    function start() {
        const rec = getRecognition();
        if (!rec) return;
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (e: any) => {
            let partial = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const r = e.results[i];
                if (r.isFinal) onFinal(r[0].transcript.trim());
                else partial += r[0].transcript;
            }
            setInterim(partial);
        };
        rec.onerror = (e: any) => {
            if (e.error === "not-allowed") toast("Microphone access was blocked");
        };
        rec.onend = () => {
            setListening(false);
            setInterim("");
        };
        rec.start();
        recRef.current = rec;
        setListening(true);
    }

    function stop() {
        recRef.current?.stop();
    }

    useEffect(() => () => recRef.current?.abort(), []);

    return { supported, listening, interim, start, stop };
}

// ---------- Page ----------

export function Practice() {
    const navigate = useNavigate();
    const [session, setSession] = useState<Session | null>(() => loadSession());
    const [mode, setMode] = useState<Mode | null>(() => session?.mode ?? null);
    const [current, setCurrent] = useState<Current | null>(null);
    const [ownQuestion, setOwnQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [busy, setBusy] = useState<null | "question" | "evaluate" | "summary">(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const speech = useSpeech((text) => setAnswer((a) => (a.trim() ? `${a.trim()} ${text}` : text)));

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [session?.turns.length, current, busy]);

    if (!session) return <Navigate to="/" replace />;
    const turns = session.turns;

    function update(next: Session) {
        setSession(next);
        saveSession(next);
    }

    async function askAi() {
        if (!session) return;
        setBusy("question");
        try {
            const q = await nextQuestion(session.context, session.report.practiceFocus, session.turns);
            setCurrent({ question: q.question, source: "ai", lookingFor: q.lookingFor, topic: q.topic, messages: [] });
        } catch (e) {
            toast(errorMessage(e));
        } finally {
            setBusy(null);
        }
    }

    function chooseMode(m: Mode) {
        setMode(m);
        if (session && session.mode !== m) update({ ...session, mode: m });
        if (m === "ai" && !current) askAi();
    }

    function submitOwnQuestion() {
        const q = ownQuestion.trim();
        if (!q) return;
        setCurrent({ question: q, source: "own", messages: [] });
        setOwnQuestion("");
    }

    /**
     * Sends what the candidate typed/said. The AI decides what it is:
     * an answer (scored, question closes), a question back or a hint request
     * (interviewer replies, question stays open), or a skip (model answer, question closes).
     */
    async function send(button?: "hint_request" | "skip") {
        if (!session || !current) return;
        if (speech.listening) speech.stop();
        const text = button ? answer.trim() || (button === "skip" ? SKIP_TEXT : HINT_TEXT) : answer.trim();
        if (!text) {
            toast("Type or speak your answer first");
            return;
        }
        setBusy("evaluate");
        try {
            const r = await respond(session.context, current.question, text, current.messages, button);
            const base = {
                question: current.question,
                source: current.source,
                lookingFor: current.lookingFor,
                messages: current.messages,
                answer: text,
            };

            if (r.kind === "answer" && r.feedback) {
                const turn: Turn = { ...base, outcome: "answered", feedback: r.feedback };
                update({ ...session, turns: [...session.turns, turn], summary: undefined });
                setCurrent(null);
            } else if (r.kind === "skip") {
                const turn: Turn = { ...base, outcome: "skipped", modelAnswer: r.modelAnswer ?? undefined };
                update({ ...session, turns: [...session.turns, turn], summary: undefined });
                setCurrent(null);
            } else {
                // Clarification or hint: the interviewer replies and the question stays open.
                setCurrent({
                    ...current,
                    messages: [...current.messages, { from: "candidate", text }, { from: "interviewer", text: r.reply }],
                });
            }
            setAnswer("");
        } catch (e) {
            toast(errorMessage(e));
        } finally {
            setBusy(null);
        }
    }

    async function finish() {
        if (!session) return;
        if (speech.listening) speech.stop();
        if (answered.length === 0) {
            // Only scored answers go into the summary; skips and hints have no score.
            toast(
                answer.trim()
                    ? "Press Send first so your answer gets scored, then finish."
                    : "Answer at least one question first. Skipped questions and hints aren't scored.",
            );
            return;
        }
        setBusy("summary");
        try {
            const summary = await summarize(session.context, session.turns);
            update({ ...session, summary });
            navigate("/summary");
        } catch (e) {
            toast(errorMessage(e));
            setBusy(null);
        }
    }

    const answered = turns.filter(isAnswered);
    const skipped = turns.length - answered.length;
    const avg = answered.length ? answered.reduce((s, t) => s + t.feedback.score, 0) / answered.length : 0;

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Steps current={3} />
                {turns.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                        {answered.length} answered
                        {answered.length > 0 && ` · avg ${avg.toFixed(1)}/10`}
                        {skipped > 0 && ` · ${skipped} skipped`}
                    </span>
                )}
            </div>

            <header className="mt-6">
                <h1 className="text-2xl font-bold tracking-tight">Practice interview</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Role: <span className="text-foreground">{session.report.targetRole}</span>
                </p>
            </header>

            {/* Mode picker */}
            {mode === null ? (
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <ModeCard
                        icon={Sparkles}
                        title="AI asks me questions"
                        text="Questions generated from the role and your CV/GitHub, getting harder as you go."
                        onClick={() => chooseMode("ai")}
                    />
                    <ModeCard
                        icon={MessageSquarePlus}
                        title="I choose my own question"
                        text="Type any question you want to practise (e.g. one from a real interview) and answer it."
                        onClick={() => chooseMode("own")}
                    />
                </div>
            ) : (
                <div className="mt-6 inline-flex w-fit rounded-lg border border-border bg-card/60 p-1 text-sm">
                    {(["ai", "own"] as const).map((m) => (
                        <button
                            key={m}
                            type="button"
                            disabled={busy !== null}
                            onClick={() => chooseMode(m)}
                            className={cn(
                                "rounded-md px-3 py-1.5 transition-colors",
                                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {m === "ai" ? "AI questions" : "My own question"}
                        </button>
                    ))}
                </div>
            )}

            {/* Conversation */}
            <div className="mt-6 flex flex-col gap-5">
                {turns.map((t, i) => (
                    <div key={i} className="flex flex-col gap-3">
                        <Bubble who="ai" label={t.source === "own" ? "Your question" : `Question ${i + 1}`}>
                            {t.question}
                        </Bubble>
                        <Thread messages={t.messages ?? []} />
                        <Bubble who="user">{t.answer}</Bubble>
                        {isAnswered(t) ? (
                            <FeedbackCard feedback={t.feedback} lookingFor={t.lookingFor} />
                        ) : (
                            <SkippedCard modelAnswer={t.modelAnswer} lookingFor={t.lookingFor} />
                        )}
                    </div>
                ))}

                {current && (
                    <div className="flex flex-col gap-3">
                        <Bubble who="ai" label={current.source === "own" ? "Your question" : `Question ${turns.length + 1}`}>
                            {current.question}
                        </Bubble>
                        <Thread messages={current.messages} />
                    </div>
                )}

                {busy === "question" && <Thinking text="Preparing a question…" />}
                {busy === "evaluate" && <Thinking text="Interviewer is thinking…" />}
            </div>

            {/* Input area */}
            {mode !== null && (
                // Solid background so the chat doesn't show through, plus a short fade above it.
                <div className="sticky bottom-0 mt-6 bg-background pt-3 pb-4 before:pointer-events-none before:absolute before:inset-x-0 before:-top-8 before:h-8 before:bg-gradient-to-t before:from-background before:to-transparent before:content-['']">
                    {current ? (
                        <div className="rounded-xl border border-border bg-card p-3">
                            <Textarea
                                value={speech.listening && speech.interim ? `${answer} ${speech.interim}`.trim() : answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                placeholder={
                                    speech.supported
                                        ? "Answer here (type or press Speak). You can also ask the interviewer a question…"
                                        : "Answer here. You can also ask the interviewer a question…"
                                }
                                className="max-h-60 min-h-24 border-0 bg-transparent shadow-none focus-visible:ring-0"
                                disabled={busy !== null || speech.listening}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
                                }}
                            />
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    {speech.supported ? (
                                        <Button
                                            variant={speech.listening ? "destructive" : "outline"}
                                            size="sm"
                                            onClick={speech.listening ? speech.stop : speech.start}
                                            disabled={busy !== null}
                                            className="gap-1.5"
                                        >
                                            {speech.listening ? <MicOff /> : <Mic />}
                                            {speech.listening ? "Stop" : "Speak"}
                                        </Button>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">Voice input needs Chrome or Edge</span>
                                    )}
                                    <Button variant="ghost" size="sm" onClick={() => send("hint_request")} disabled={busy !== null} className="gap-1.5">
                                        <Lightbulb /> Hint
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => send("skip")} disabled={busy !== null} className="gap-1.5">
                                        <SkipForward /> Skip
                                    </Button>
                                </div>
                                <Button size="sm" onClick={() => send()} disabled={busy !== null} className="gap-1.5">
                                    Send <Send />
                                </Button>
                            </div>
                        </div>
                    ) : mode === "own" ? (
                        <div className="flex gap-2 rounded-xl border border-border bg-card p-2">
                            <Input
                                value={ownQuestion}
                                onChange={(e) => setOwnQuestion(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && submitOwnQuestion()}
                                placeholder="Type the question you want to practise…"
                                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                                disabled={busy !== null}
                            />
                            <Button onClick={submitOwnQuestion} disabled={busy !== null || !ownQuestion.trim()}>
                                Ask
                            </Button>
                        </div>
                    ) : (
                        busy === null && (
                            <Button onClick={askAi} className="gap-2">
                                <Sparkles className="size-4" /> {turns.length ? "Next question" : "Get a question"}
                            </Button>
                        )
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                        {answered.length === 0 && (
                            <span className="text-xs text-muted-foreground">Answer at least one question to unlock your results</span>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={finish}
                            disabled={busy !== null}
                            className="gap-2"
                        >
                            {busy === "summary" ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
                            Finish & see my strengths / weaknesses
                        </Button>
                    </div>
                </div>
            )}
            <div ref={bottomRef} />
        </main>
    );
}

// ---------- Small pieces ----------

function ModeCard({
    icon: Icon,
    title,
    text,
    onClick,
}: {
    icon: typeof Sparkles;
    title: string;
    text: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-5 text-left transition-colors hover:border-ring hover:bg-card"
        >
            <Icon className="size-5 text-primary" />
            <span className="font-medium">{title}</span>
            <span className="text-sm text-muted-foreground">{text}</span>
        </button>
    );
}

function Bubble({ who, label, children }: { who: "ai" | "user"; label?: string; children: React.ReactNode }) {
    const isAi = who === "ai";
    return (
        <div className={cn("flex gap-3", !isAi && "flex-row-reverse")}>
            <div
                className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-white",
                    isAi ? "bg-gradient-to-br from-violet-400 to-indigo-600" : "bg-gradient-to-br from-emerald-300 to-teal-600",
                )}
            >
                {isAi ? <Bot className="size-4" /> : <User className="size-4" />}
            </div>
            <div
                className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    isAi ? "rounded-tl-sm bg-card text-foreground" : "rounded-tr-sm bg-primary text-primary-foreground",
                )}
            >
                {label && <p className="mb-1 text-xs text-muted-foreground">{label}</p>}
                {children}
            </div>
        </div>
    );
}

/** Clarifications and hints exchanged on a question, shown as normal chat bubbles. */
function Thread({ messages }: { messages: Exchange[] }) {
    return (
        <>
            {messages.map((m, i) => (
                <Bubble key={i} who={m.from === "interviewer" ? "ai" : "user"}>
                    {m.text}
                </Bubble>
            ))}
        </>
    );
}

function SkippedCard({ modelAnswer, lookingFor }: { modelAnswer?: string; lookingFor?: string }) {
    return (
        <div className="ml-11 rounded-xl border border-border bg-card/60 p-4 text-sm backdrop-blur">
            <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                    <SkipForward className="size-4 text-muted-foreground" /> Skipped
                </span>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                    not scored
                </span>
            </div>
            {lookingFor && (
                <p className="mt-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">What the interviewer wanted: </span>
                    {lookingFor}
                </p>
            )}
            {modelAnswer && (
                <div className="mt-3">
                    <p className="text-xs font-medium text-sky-400">Model answer</p>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed text-foreground/90">{modelAnswer}</p>
                </div>
            )}
        </div>
    );
}

function Thinking({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-2 pl-11 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {text}
        </div>
    );
}

function FeedbackCard({ feedback, lookingFor }: { feedback: Feedback; lookingFor?: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="ml-11 rounded-xl border border-border bg-card/60 p-4 text-sm backdrop-blur">
            <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                    <Sparkles className="size-4 text-violet-400" /> Feedback
                </span>
                <ScoreBadge score={feedback.score} />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <FeedbackList icon={ThumbsUp} title="Strengths" items={feedback.strengths} color="text-emerald-400" empty="Nothing stood out yet." />
                <FeedbackList icon={ThumbsDown} title="Weaknesses" items={feedback.weaknesses} color="text-rose-400" empty="No major issues." />
            </div>

            <p className="mt-3 flex gap-2 rounded-lg bg-sky-500/10 p-3 text-sky-200">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-sky-400" />
                {feedback.tip}
            </p>

            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
                <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
                {open ? "Hide" : "Show"} a stronger answer
            </button>
            {open && (
                <div className="mt-2 flex flex-col gap-2 rounded-lg border border-border p-3 text-foreground/90">
                    {lookingFor && (
                        <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">What the interviewer wanted: </span>
                            {lookingFor}
                        </p>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{feedback.betterAnswer}</p>
                </div>
            )}
        </div>
    );
}

function FeedbackList({
    icon: Icon,
    title,
    items,
    color,
    empty,
}: {
    icon: typeof ThumbsUp;
    title: string;
    items: string[];
    color: string;
    empty: string;
}) {
    return (
        <div>
            <p className={cn("flex items-center gap-1.5 text-xs font-medium", color)}>
                <Icon className="size-3.5" /> {title}
            </p>
            {items.length ? (
                <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-foreground/90">
                    {items.map((s, i) => (
                        <li key={i}>{s}</li>
                    ))}
                </ul>
            ) : (
                <p className="mt-1.5 text-muted-foreground">{empty}</p>
            )}
        </div>
    );
}
