import { Navigate, useNavigate } from "react-router";
import { ArrowLeft, Footprints, RotateCcw, ThumbsDown, ThumbsUp, Trophy } from "lucide-react";
import { Button } from "../ui/button";
import { ListCard, ScoreBadge, Steps } from "./shared";
import { isAnswered, loadSession, saveSession } from "@/lib/practice";

export function SummaryPage() {
    const navigate = useNavigate();
    const session = loadSession();
    if (!session) return <Navigate to="/" replace />;
    if (!session.summary) return <Navigate to="/practice" replace />;

    const { summary, turns, report } = session;

    function practiceAgain() {
        if (!session) return;
        saveSession({ ...session, turns: [], summary: undefined });
        navigate("/practice");
    }

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10 sm:px-6">
            <Steps current={4} />

            <section className="mt-8 rounded-xl border border-border bg-card/60 p-6 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                            <Trophy className="size-3.5" /> Your interview result
                        </p>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight">{report.targetRole}</h1>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {turns.filter(isAnswered).length} answered
                            {turns.some((t) => !isAnswered(t)) && ` · ${turns.filter((t) => !isAnswered(t)).length} skipped`}
                        </p>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold tracking-tight">{summary.overallScore}</span>
                        <span className="text-sm text-muted-foreground">/ 10</span>
                    </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-foreground/90">{summary.summary}</p>
            </section>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <ListCard title="Your strengths" items={summary.strengths} icon={ThumbsUp} tone="good" />
                <ListCard title="Your weaknesses" items={summary.weaknesses} icon={ThumbsDown} tone="bad" />
            </div>
            <div className="mt-4">
                <ListCard title="What to do next" items={summary.nextSteps} icon={Footprints} tone="info" />
            </div>

            <section className="mt-8">
                <h2 className="mb-3 text-sm font-medium text-muted-foreground">Your answers</h2>
                <ol className="flex flex-col gap-2">
                    {turns.map((t, i) => (
                        <li key={i} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card/40 p-3 text-sm">
                            <span>
                                <span className="text-muted-foreground">Q{i + 1}. </span>
                                {t.question}
                            </span>
                            {isAnswered(t) ? (
                                <ScoreBadge score={t.feedback.score} className="shrink-0" />
                            ) : (
                                <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                                    skipped
                                </span>
                            )}
                        </li>
                    ))}
                </ol>
            </section>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => navigate("/practice")} className="gap-2">
                    <ArrowLeft className="size-4" /> Back to practice
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate("/")}>
                        New profile
                    </Button>
                    <Button onClick={practiceAgain} className="gap-2">
                        <RotateCcw className="size-4" /> Practise again
                    </Button>
                </div>
            </div>
        </main>
    );
}
