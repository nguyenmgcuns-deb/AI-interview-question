import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { loadSession } from "@/lib/practice";

/** A titled card with a bullet list. Renders nothing if the list is empty. */
export function ListCard({
    title,
    items,
    icon: Icon,
    tone = "neutral",
}: {
    title: string;
    items: string[];
    icon: LucideIcon;
    tone?: "good" | "bad" | "neutral" | "info";
}) {
    if (items.length === 0) return null;
    const color = {
        good: "text-emerald-400",
        bad: "text-rose-400",
        neutral: "text-muted-foreground",
        info: "text-sky-400",
    }[tone];

    return (
        <section className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur">
            <h3 className="flex items-center gap-2 text-sm font-medium">
                <Icon className={cn("size-4", color)} />
                {title}
            </h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-foreground/90">
                {items.map((item, i) => (
                    <li key={i} className="flex gap-2">
                        <span className={cn("mt-2 size-1.5 shrink-0 rounded-full bg-current", color)} />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/** Colored "7/10" badge. */
export function ScoreBadge({ score, max = 10, className }: { score: number; max?: number; className?: string }) {
    const ratio = score / max;
    const color =
        ratio >= 0.7
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            : ratio >= 0.4
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-rose-500/40 bg-rose-500/10 text-rose-300";
    return (
        <span className={cn("inline-flex items-baseline gap-0.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold", color, className)}>
            {score}
            <span className="text-xs font-normal opacity-70">/{max}</span>
        </span>
    );
}

/** Step indicator shown at the top of each page. Steps you can visit are clickable. */
export function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
    const session = loadSession();
    const steps = [
        { label: "Upload", to: "/", open: true },
        { label: "Fit check", to: "/fit", open: !!session },
        { label: "Practice", to: "/practice", open: !!session },
        { label: "Summary", to: "/summary", open: !!session?.summary },
    ];
    return (
        <ol className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {steps.map(({ label, to, open }, i) => {
                const isCurrent = i + 1 === current;
                const content = (
                    <>
                        <span
                            className={cn(
                                "grid size-5 place-items-center rounded-full border text-[10px]",
                                isCurrent && "border-primary bg-primary text-primary-foreground",
                                !isCurrent && i + 1 < current && "border-emerald-500/50 text-emerald-400",
                            )}
                        >
                            {i + 1}
                        </span>
                        <span className={cn(isCurrent && "text-foreground")}>{label}</span>
                    </>
                );
                return (
                    <li key={label} className="flex items-center gap-2">
                        {open && !isCurrent ? (
                            <Link
                                to={to}
                                title={`Go to ${label}`}
                                className="-mx-1 flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-card hover:text-foreground"
                            >
                                {content}
                            </Link>
                        ) : (
                            <span
                                className={cn("flex items-center gap-2", !open && "opacity-50")}
                                title={open ? undefined : "Not available yet"}
                            >
                                {content}
                            </span>
                        )}
                        {i < steps.length - 1 && <span className="mx-1 h-px w-4 bg-border" />}
                    </li>
                );
            })}
        </ol>
    );
}
