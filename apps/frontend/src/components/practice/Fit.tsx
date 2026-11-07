import { Navigate, useNavigate } from "react-router";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileEdit, Target, ThumbsUp, TrendingDown, XCircle, HelpCircle } from "lucide-react";
import { Button } from "../ui/button";
import { ListCard, Steps } from "./shared";
import { loadSession, type Verdict } from "@/lib/practice";
import { cn } from "@/lib/utils";

const VERDICT: Record<Verdict, { label: string; icon: typeof CheckCircle2; className: string }> = {
    strong_match: {
        label: "Strong match",
        icon: CheckCircle2,
        className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    },
    partial_match: {
        label: "Partial match",
        icon: AlertTriangle,
        className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    },
    mismatch: {
        label: "Doesn't match",
        icon: XCircle,
        className: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    },
    not_enough_info: {
        label: "Review only",
        icon: HelpCircle,
        className: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    },
};

export function Fit() {
    const navigate = useNavigate();
    const session = loadSession();
    if (!session) return <Navigate to="/" replace />;

    const { report, sources } = session;
    const verdict = VERDICT[report.verdict];
    const used = [sources.github && "GitHub", sources.cv && "CV", sources.job && "job description"].filter(Boolean);

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10 sm:px-6">
            <Steps current={2} />

            <section className="mt-8 rounded-xl border border-border bg-card/60 p-6 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Target role</p>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight">{report.targetRole}</h1>
                        <p className="mt-1 text-xs text-muted-foreground">Based on: {used.join(", ")}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <span
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
                                verdict.className,
                            )}
                        >
                            <verdict.icon className="size-4" />
                            {verdict.label}
                        </span>
                        {report.verdict !== "not_enough_info" && (
                            <span className="text-sm text-muted-foreground">
                                Match <span className="text-xl font-bold text-foreground">{report.matchScore}</span>/100
                            </span>
                        )}
                    </div>
                </div>

                {report.verdict !== "not_enough_info" && (
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                            className={cn(
                                "h-full rounded-full",
                                report.matchScore >= 70
                                    ? "bg-emerald-400"
                                    : report.matchScore >= 40
                                      ? "bg-amber-400"
                                      : "bg-rose-400",
                            )}
                            style={{ width: `${Math.max(3, report.matchScore)}%` }}
                        />
                    </div>
                )}

                <p className="mt-4 text-sm leading-relaxed text-foreground/90">{report.verdictReason}</p>
                {report.candidateSummary && (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{report.candidateSummary}</p>
                )}
            </section>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <ListCard title="What already fits" items={report.strengths} icon={ThumbsUp} tone="good" />
                <ListCard title="Gaps for this role" items={report.gaps} icon={TrendingDown} tone="bad" />
            </div>

            <div className="mt-4 flex flex-col gap-4">
                <ListCard title="How to improve your CV" items={report.cvAdvice} icon={FileEdit} tone="info" />
                <ListCard title="What we'll practise" items={report.practiceFocus} icon={Target} />
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
                    <ArrowLeft className="size-4" /> Change uploads
                </Button>
                <Button size="lg" onClick={() => navigate("/practice")} className="gap-2">
                    Continue to practice <ArrowRight className="size-4" />
                </Button>
            </div>
        </main>
    );
}
