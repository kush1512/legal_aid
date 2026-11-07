"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, BriefcaseBusiness, FileText, Lock, Mic, MessagesSquare, Scale, Search, EyeOff, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { CATEGORIES, DRAFT_KEY } from "@/lib/constants";
import { useAsync } from "@/lib/hooks/useAsync";
import { writeJson } from "@/lib/local/store";
import { Button, Card, EmptyState, ErrorState, LoadingBlock } from "@/components/ui";
import { CaseCard, CategoryCard } from "@/components/domain";
import Link from "next/link";

const QUICK = [
  { href: "/community", label: "Community", blurb: "Learn from others' experiences", icon: MessagesSquare },
  { href: "/lawyers", label: "Find a lawyer", blurb: "Verified, filter by area and language", icon: Scale },
  { href: "/legal", label: "Search the law", blurb: "Look up Acts and sections", icon: Search },
  { href: "/studio", label: "Document studio", blurb: "Draft a notice or complaint", icon: FileText },
];

export default function HomePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const recent = useAsync(() => api.listCases({ limit: 3 }), []);

  function start(mode: "text" | "voice") {
    if (text.trim()) writeJson(DRAFT_KEY, text.trim(), "session");
    router.push(`/case/new${mode === "voice" ? "?mode=voice" : ""}`);
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="hero" className="rounded-xl2 bg-navy p-6 text-white sm:p-10">
        <h1 id="hero" className="max-w-2xl text-2xl font-semibold leading-tight sm:text-4xl">Tell us what happened. We’ll help you understand where you stand.</h1>
        <p className="mt-3 max-w-xl text-white/85">Plain-language guidance on your rights, the next step to take, and the documents you may need. Start without giving your name.</p>

        <div className="mt-6 rounded-xl bg-white p-4 text-navy">
          <label htmlFor="quick-entry" className="sr-only">Describe your legal problem</label>
          <textarea id="quick-entry" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="For example: I paid for a plot but the seller won’t hand over possession…"
            className="w-full resize-none rounded-lg border border-navy/20 p-3 text-sm placeholder:text-navy/50 focus:border-teal focus:outline-none" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="lg" icon={ArrowRight} onClick={() => start("text")}>Start a new case</Button>
            <Button size="lg" variant="secondary" icon={Mic} onClick={() => start("voice")}>Speak instead</Button>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-navy/75"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" aria-hidden />Nothing is sent until you review it and choose what to share on the next screen.</p>
        </div>
      </section>

      <section aria-labelledby="cats">
        <h2 id="cats" className="mb-3 text-xl font-semibold">What is your problem about?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {CATEGORIES.map((c) => <CategoryCard key={c.value} cat={c} href={`/case/new?category=${c.value}`} />)}
        </div>
      </section>

      <section aria-labelledby="recent">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent" className="text-xl font-semibold">Recent cases</h2>
          <Link href="/cases" className="text-sm font-semibold text-teal-700 underline">All cases</Link>
        </div>
        {recent.loading ? <LoadingBlock rows={2} /> : recent.error ? <ErrorState error={recent.error} onRetry={recent.reload} /> :
          recent.data && recent.data.items.length ? <ul className="space-y-3">{recent.data.items.map((c) => <CaseCard key={c.id} c={c} />)}</ul> :
          <EmptyState icon={BriefcaseBusiness} title="No cases yet" action={<Button href="/case/new">Start your first case</Button>}>Your cases appear here, private to your account.</EmptyState>}
      </section>

      <section aria-labelledby="quick">
        <h2 id="quick" className="mb-3 text-xl font-semibold">Quick links</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK.map((q) => (
            <li key={q.href}><Link href={q.href} className="flex h-full flex-col gap-1 rounded-xl2 border border-navy/10 bg-white p-4 shadow-card hover:border-teal/60">
              <q.icon className="h-5 w-5 text-teal-700" aria-hidden /><span className="font-semibold">{q.label}</span><span className="text-sm text-navy/75">{q.blurb}</span></Link></li>
          ))}
        </ul>
      </section>

      <Card className="flex flex-col gap-3 bg-mist/60 sm:flex-row sm:items-center">
        <EyeOff className="h-6 w-6 shrink-0 text-teal-700" aria-hidden />
        <div className="text-sm"><p className="font-semibold">Private by default</p>
          <p className="text-navy/85">Your account identity is never shown publicly. Community posts can be anonymous, and case details are shared with an AI service only when you say so. <Link href="/profile" className="font-semibold text-teal-700 underline">Review privacy controls</Link></p></div>
        <Lock className="hidden h-5 w-5 text-teal-700 sm:block" aria-hidden />
      </Card>
    </div>
  );
}
