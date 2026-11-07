"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Home, Lock, Mic, Square, Users, ShieldAlert, FileSearch, ChevronRight, Loader2 } from "lucide-react";
import { api, describeError, type Case, type CaseCategory, type LegalCitation, type SourceStatus } from "@/lib/api";
import { CATEGORIES, STATUS_META, categoryLabel } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";
import { Badge, Card, Notice, PrivacyHint, ProgressBar } from "./ui";

const ICONS = { Home, Users, ShieldAlert, Lock } as const;
export const CategoryIcon = ({ name, className }: { name: keyof typeof ICONS; className?: string }) => {
  const I = ICONS[name];
  return <I className={className} aria-hidden />;
};

export function CategoryCard({ cat, href }: { cat: (typeof CATEGORIES)[number]; href: string }) {
  return (
    <Link href={href} className="group flex items-start gap-3 rounded-xl2 border border-navy/10 bg-white p-4 shadow-card hover:border-teal/60">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mist text-teal-700"><CategoryIcon name={cat.icon} className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block font-semibold leading-snug">{cat.label}</span><span className="mt-0.5 block text-sm text-navy/75">{cat.blurb}</span></span>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-navy/40 group-hover:text-teal-700" aria-hidden />
    </Link>
  );
}

export function CaseCard({ c }: { c: Case }) {
  const meta = STATUS_META[c.status];
  return (
    <li>
      <Link href={`/cases/${c.id}`} className="block rounded-xl2 border border-navy/10 bg-white p-4 shadow-card hover:border-teal/60">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="mist">{categoryLabel(c.category)}</Badge>
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {c.sensitive && <Badge tone="neutral" icon={Lock}>Sensitive: kept off external AI</Badge>}
        </div>
        <h3 className="mt-2 line-clamp-2 font-display text-lg font-semibold leading-snug">{c.title}</h3>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1"><ProgressBar value={meta.progress} label={`Progress: ${meta.label}`} /></div>
          <span className="shrink-0 text-xs text-navy/70">Updated {timeAgo(c.updated_at)}</span>
        </div>
      </Link>
    </li>
  );
}

export function ConsentCheckbox({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-teal/30 bg-mist/60 p-3.5">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-teal-600" />
      <label htmlFor={id} className="text-sm leading-relaxed">{children}</label>
    </div>
  );
}

const STATUS_TONE: Record<SourceStatus, { tone: "teal" | "amber" | "neutral" | "danger"; label: string }> = {
  verified: { tone: "teal", label: "Verified source" },
  unverified: { tone: "amber", label: "Not yet verified" },
  historical: { tone: "neutral", label: "Historical" },
  superseded: { tone: "danger", label: "Superseded" },
};
export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  const m = STATUS_TONE[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function CitationCard({ citation, explanation, applicability }: { citation: LegalCitation; explanation?: string; applicability?: string }) {
  return (
    <Card as="article" className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SourceStatusBadge status={citation.source_status} />
        {applicability && <Badge tone="mist">Applicability: {applicability.replace("_", " ")}</Badge>}
      </div>
      <h4 className="mt-2 font-display text-base font-semibold">{citation.act_name}{citation.section_label ? `, ${citation.section_label}` : ""}</h4>
      {citation.title && <p className="text-sm text-navy/80">{citation.title}</p>}
      {explanation && <p className="mt-2 text-sm">{explanation}</p>}
      <p className="mt-2 border-l-2 border-teal/50 pl-3 text-sm italic text-navy/80">{citation.excerpt}</p>
      {citation.source_status !== "verified" && <p className="mt-2 text-xs text-amber-700">This source has not been confirmed as current. Check the official text before relying on it.</p>}
      <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
        <Link href={`/legal/${citation.id}`} className="inline-flex items-center gap-1 text-teal-700 underline"><FileSearch className="h-4 w-4" aria-hidden />Explain this provision</Link>
        <a href={citation.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-teal-700 underline">Official source<ExternalLink className="h-3.5 w-3.5" aria-hidden /><span className="sr-only"> (opens in a new tab)</span></a>
      </div>
    </Card>
  );
}

/** Records audio with MediaRecorder, sends it to POST /speech/transcribe and hands the text back for review. */
export function VoiceRecorder({ caseId, consent, onTranscript, disabled }: { caseId?: string; consent: boolean; onTranscript: (text: string) => void; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => () => { timer.current && clearInterval(timer.current); stream.current?.getTracks().forEach((t) => t.stop()); }, []);

  async function start() {
    setErr(null);
    if (!consent) { setErr("Tick the consent box below first. Voice is processed by an external speech service."); return; }
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) { setErr("This browser can't record audio. Type your description instead."); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const r = new MediaRecorder(s);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        s.getTracks().forEach((t) => t.stop());
        setState("processing");
        try {
          const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
          const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
          const file = new File([blob], `recording.${ext}`, { type: blob.type });
          const res = await api.transcribe(file, { caseId, externalAiConsent: consent });
          onTranscript(res.transcript);
        } catch (e) {
          const d = describeError(e);
          setErr(`${d.title}. ${d.hint} You can type your description instead.`);
        } finally { setState("idle"); }
      };
      rec.current = r; r.start(); setSecs(0); setState("recording");
      timer.current = setInterval(() => setSecs((x) => x + 1), 1000);
    } catch {
      setErr("Microphone access was denied. Allow it in your browser, or type your description instead.");
    }
  }
  function stop() { timer.current && clearInterval(timer.current); rec.current?.stop(); }
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {state !== "recording" ? (
          <button type="button" onClick={start} disabled={disabled || state === "processing"}
            className="inline-flex items-center gap-2 rounded-xl border border-navy/25 bg-white px-3.5 py-2 text-sm font-semibold hover:bg-mist/60 disabled:opacity-50">
            {state === "processing" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mic className="h-4 w-4 text-teal-700" aria-hidden />}
            {state === "processing" ? "Transcribing…" : "Record your account"}
          </button>
        ) : (
          <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-xl bg-danger px-3.5 py-2 text-sm font-semibold text-white">
            <Square className="h-4 w-4 fill-current" aria-hidden />Stop and transcribe
          </button>
        )}
        {state === "recording" && <span role="timer" aria-live="off" className="flex items-center gap-2 text-sm font-semibold text-danger"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />Recording {mmss}</span>}
      </div>
      <PrivacyHint>Audio is not stored. The transcript appears in the box below so you can edit it before anything is sent.</PrivacyHint>
      {err && <p role="alert" className="text-sm font-medium text-danger">{err}</p>}
    </div>
  );
}

export function MockAiBadge({ isMock, provider, model }: { isMock: boolean; provider?: string; model?: string }) {
  return isMock
    ? <Badge tone="amber">Demo output · not real AI</Badge>
    : <Badge tone="neutral">AI-assisted{provider ? ` · ${provider}` : ""}{model && model !== "none" ? ` · ${model}` : ""}</Badge>;
}

export function LegalDisclaimer({ children }: { children?: React.ReactNode }) {
  return <Notice tone="warn" title="Information, not legal advice">{children ?? "AI-assisted output can be incomplete or wrong, and it is not legal representation. Have a qualified lawyer review it before you act."}</Notice>;
}

export const cx = cn;
