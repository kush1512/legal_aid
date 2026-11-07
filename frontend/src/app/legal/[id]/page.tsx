"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { formatDate } from "@/lib/utils";
import { Card, ErrorState, LoadingBlock, Notice } from "@/components/ui";
import { LegalDisclaimer, SourceStatusBadge } from "@/components/domain";

export default function ProvisionPage() {
  const { id } = useParams<{ id: string }>();
  const r = useAsync(() => api.getProvision(id), [id]);
  return (
    <>
      <Link href="/legal" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700"><ArrowLeft className="h-4 w-4" aria-hidden />Search the law</Link>
      {r.loading ? <LoadingBlock rows={3} /> : r.error || !r.data ? <ErrorState error={r.error} onRetry={r.reload} /> : (() => {
        const p = r.data.provision, c = p.citation;
        return (
          <article className="space-y-6">
            <header className="space-y-2">
              <SourceStatusBadge status={c.source_status} />
              <h1 className="text-2xl font-semibold sm:text-3xl">{c.section_label ?? "Provision"}{c.title ? `: ${c.title}` : ""}</h1>
              <p className="text-navy/80">{c.act_name}</p>
            </header>
            {c.source_status !== "verified" && <Notice tone="warn" title="Source not confirmed as current">An operator has not verified this text’s authority, amendments or effective dates. Check the official source before relying on it.</Notice>}
            <section aria-labelledby="p-plain"><h2 id="p-plain" className="mb-2 text-lg font-semibold">In plain words</h2><Card className="text-sm leading-relaxed">{c.excerpt}</Card>
              <p className="mt-2 text-xs text-navy/70">The API supplies the indexed excerpt and full text below. A separate simplified explanation appears on a case’s assessment when one has been generated for your facts.</p></section>
            <section aria-labelledby="p-text"><h2 id="p-text" className="mb-2 text-lg font-semibold">Full indexed text</h2><Card><pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{p.full_text}</pre></Card></section>
            <section aria-labelledby="p-prov"><h2 id="p-prov" className="mb-2 text-lg font-semibold">Source and status</h2>
              <dl className="grid gap-3 rounded-xl2 bg-white p-4 text-sm shadow-card sm:grid-cols-2">
                <div><dt className="text-navy/60">Act</dt><dd className="font-medium">{c.act_name}</dd></div>
                <div><dt className="text-navy/60">Jurisdiction</dt><dd className="font-medium">{p.jurisdiction ?? "Not stated"}</dd></div>
                <div><dt className="text-navy/60">Document version</dt><dd className="font-medium">{p.document_version ?? "Not stated"}</dd></div>
                <div><dt className="text-navy/60">Effective</dt><dd className="font-medium">{p.effective_from ? formatDate(p.effective_from) : "Date not stated"}{p.effective_to ? ` to ${formatDate(p.effective_to)}` : ""}</dd></div>
              </dl>
              <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-700 underline">Read the official text<ExternalLink className="h-3.5 w-3.5" aria-hidden /><span className="sr-only"> (opens in a new tab)</span></a>
            </section>
            <LegalDisclaimer>Whether this provision applies to your situation depends on your facts. Ask a verified lawyer before acting on it.</LegalDisclaimer>
          </article>);
      })()}
    </>
  );
}
