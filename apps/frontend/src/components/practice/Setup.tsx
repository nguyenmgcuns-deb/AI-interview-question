import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import Tesseract from "tesseract.js";
import { ArrowRight, Briefcase, FileText, Github, ImageUp, Loader2, Upload, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Steps } from "./shared";
import { analyze, errorMessage, saveSession } from "@/lib/practice";

const MAX_CV_BYTES = 5 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

export function Setup() {
    const navigate = useNavigate();
    const [github, setGithub] = useState("");
    const [cvFile, setCvFile] = useState<File | null>(null);
    const [cvText, setCvText] = useState("");
    const [cvMode, setCvMode] = useState<"file" | "text">("file");
    const [jobText, setJobText] = useState("");
    const [ocrProgress, setOcrProgress] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    const cvInput = useRef<HTMLInputElement>(null);
    const jobImageInput = useRef<HTMLInputElement>(null);

    const hasGithub = github.trim().length > 0;
    const hasCv = cvMode === "file" ? !!cvFile : cvText.trim().length > 0;
    const hasJob = jobText.trim().length > 0;
    const count = [hasGithub, hasCv, hasJob].filter(Boolean).length;

    function pickCv(file: File | undefined) {
        if (!file) return;
        if (!/\.(pdf|txt|md)$/i.test(file.name)) {
            toast("CV must be a PDF, .txt or .md file");
            return;
        }
        if (file.size > MAX_CV_BYTES) {
            toast("CV file is too large (max 5 MB)");
            return;
        }
        setCvFile(file);
    }

    /** Reads the text out of a job-post screenshot in the browser. */
    async function readJobImage(file: File | undefined) {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast("Please choose an image (PNG, JPG…)");
            return;
        }
        setOcrProgress(0);
        try {
            const { data } = await Tesseract.recognize(file, "eng", {
                logger: (m) => m.status === "recognizing text" && setOcrProgress(Math.round(m.progress * 100)),
            });
            const text = data.text.trim();
            if (!text) {
                toast("Couldn't find any text in that image");
                return;
            }
            setJobText((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
            toast("Text pulled from the screenshot. Check it and fix any mistakes.");
        } catch {
            toast("Couldn't read that image. Try pasting the text instead.");
        } finally {
            setOcrProgress(null);
        }
    }

    async function onStart() {
        if (count === 0) {
            toast("Add at least one: GitHub, CV, or job description");
            return;
        }
        setLoading(true);
        try {
            const result = await analyze({
                github: hasGithub ? github.trim() : undefined,
                cvFile:
                    cvMode === "file" && cvFile
                        ? { name: cvFile.name, base64: await fileToBase64(cvFile) }
                        : undefined,
                cvText: cvMode === "text" && hasCv ? cvText.trim() : undefined,
                jobText: hasJob ? jobText.trim() : undefined,
            });
            saveSession({ ...result, turns: [] });
            navigate("/fit");
        } catch (e) {
            toast(errorMessage(e));
            setLoading(false);
        }
    }

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10 sm:px-6">
            <Steps current={1} />

            <div className="mt-8 text-center">
                <h1 className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
                    AI Interview Kickstart
                </h1>
                <p className="mx-auto mt-4 max-w-lg text-balance text-muted-foreground">
                    Add your GitHub, your CV, or the job you're applying for (one is enough, more is
                    better). The AI checks that they match, gives CV advice, then lets you practise.
                </p>
            </div>

            <div className="mt-10 flex flex-col gap-4">
                {/* GitHub */}
                <section className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur">
                    <label className="flex items-center gap-2 text-sm font-medium">
                        <Github className="size-4" /> GitHub profile
                        <span className="text-xs font-normal text-muted-foreground">optional</span>
                    </label>
                    <Input
                        className="mt-3"
                        value={github}
                        placeholder="https://github.com/your-username"
                        onChange={(e) => setGithub(e.target.value)}
                        disabled={loading}
                    />
                </section>

                {/* CV */}
                <section className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur">
                    <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                            <FileText className="size-4" /> Your CV
                            <span className="text-xs font-normal text-muted-foreground">optional</span>
                        </label>
                        <button
                            type="button"
                            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                            onClick={() => setCvMode(cvMode === "file" ? "text" : "file")}
                            disabled={loading}
                        >
                            {cvMode === "file" ? "Paste text instead" : "Upload a file instead"}
                        </button>
                    </div>

                    {cvMode === "file" ? (
                        <div
                            className="mt-3 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                pickCv(e.dataTransfer.files[0]);
                            }}
                        >
                            {cvFile ? (
                                <div className="flex items-center gap-2 text-foreground">
                                    <FileText className="size-4 text-primary" />
                                    <span className="max-w-[16rem] truncate">{cvFile.name}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Remove CV"
                                        onClick={() => setCvFile(null)}
                                        disabled={loading}
                                    >
                                        <X />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <Upload className="size-5" />
                                    <span>Drop your CV here, or</span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => cvInput.current?.click()}
                                        disabled={loading}
                                    >
                                        Choose file
                                    </Button>
                                    <span className="text-xs">PDF, TXT or MD · max 5 MB</span>
                                </>
                            )}
                            <input
                                ref={cvInput}
                                type="file"
                                accept=".pdf,.txt,.md"
                                hidden
                                onChange={(e) => {
                                    pickCv(e.target.files?.[0]);
                                    e.target.value = "";
                                }}
                            />
                        </div>
                    ) : (
                        <Textarea
                            className="mt-3 max-h-64 min-h-32"
                            value={cvText}
                            placeholder="Paste the text of your CV…"
                            onChange={(e) => setCvText(e.target.value)}
                            disabled={loading}
                        />
                    )}
                </section>

                {/* Job description */}
                <section className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur">
                    <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                            <Briefcase className="size-4" /> Job / role you're applying for
                            <span className="text-xs font-normal text-muted-foreground">optional</span>
                        </label>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => jobImageInput.current?.click()}
                            disabled={loading || ocrProgress !== null}
                        >
                            {ocrProgress !== null ? (
                                <>
                                    <Loader2 className="animate-spin" /> Reading {ocrProgress}%
                                </>
                            ) : (
                                <>
                                    <ImageUp /> Upload screenshot
                                </>
                            )}
                        </Button>
                        <input
                            ref={jobImageInput}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                                readJobImage(e.target.files?.[0]);
                                e.target.value = "";
                            }}
                        />
                    </div>
                    <Textarea
                        className="mt-3 max-h-64 min-h-32"
                        value={jobText}
                        placeholder="Paste the job post here, or upload / paste (Ctrl+V) a screenshot of it…"
                        onChange={(e) => setJobText(e.target.value)}
                        onPaste={(e) => {
                            const image = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
                            if (image) {
                                e.preventDefault();
                                readJobImage(image);
                            }
                        }}
                        disabled={loading || ocrProgress !== null}
                    />
                </section>
            </div>

            <div className="mt-8 flex flex-col items-center gap-3">
                <Button size="lg" className="gap-2 px-8" onClick={onStart} disabled={loading || ocrProgress !== null}>
                    {loading ? (
                        <>
                            <Loader2 className="size-4 animate-spin" /> Checking your profile…
                        </>
                    ) : (
                        <>
                            Start interview <ArrowRight className="size-4" />
                        </>
                    )}
                </Button>
                <p className="text-xs text-muted-foreground">
                    {count === 0
                        ? "Add at least one item above."
                        : count === 1
                          ? "Tip: add a second item so the AI can check they match."
                          : `${count} of 3 added. The AI will check they match.`}
                </p>
            </div>
        </main>
    );
}
