"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { api, type CaseCategory, type LegalSearchResponse } from "@/lib/api";
import { CATEGORIES, INDIAN_STATES } from "@/lib/constants";
import { Badge, Button, EmptyState, ErrorState, Field, LoadingBlock, Notice, PageHeader, inputCls } from "@/components/ui";
import { CitationCard } from "@/components/domain";

export default function LegalSearchPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<CaseCategory | "">("");
  const [state, setState] = useState("");
  const [res, setRes] = useState<LegalSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [tooShort, setTooShort] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) { setTooShort(true); return; }
    setTooShort(false); setLoading(true); setError(null);
    try {
      setRes(await api.searchLegal({ query: q.trim(), category: category || undefined, jurisdiction: { country: "IN", ...(state && { state }) }, limit: 10 }));
    } catch (err) { setError(err); setRes(null); } finally { setLoading(false); }
  }

  return (
    <>
      <PageHeader title="Search the law" subtitle="Look up Acts and sections from the verified legal knowledge base. Results show what a provision says, not whether it applies to you." />
      <form onSubmit={run} className="mb-6 space-y-3 rounded-xl2 border border-navy/10 bg-white p-4 shadow-card" role="search">
        <Field id="lq" label="What are you looking for?" error={tooShort ? "Enter at least 2 characters." : undefined}>
          <input id="lq" className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. remedy for non-delivery of property possession" maxLength={2000} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="lc" label="Category (optional)"><select id="lc" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as CaseCategory | "")}><option value="">Any</option>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
          <Field id="ls" label="State (optional)"><select id="ls" className={inputCls} value={state} onChange={(e) => setState(e.target.value)}><option value="">Any</option>{INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <Button type="submit" icon={Search} loading={loading}>Search</Button>
      </form>

      {loading ? <LoadingBlock rows={2} /> : error ? <ErrorState error={error} onRetry={() => run(new Event("submit") as unknown as React.FormEvent)} /> : res && (
        <div className="space-y-3" aria-live="polite">
          <Notice tone="warn">{res.warning}</Notice>
          {res.results.length === 0 ? <EmptyState icon={Search} title="No matching provisions found">We don’t guess. Try different words, remove the category, or ask a lawyer.</EmptyState> :
            res.results.map((r) => (
              <div key={r.citation.id}>
                <div className="mb-1 flex gap-2"><Badge tone="neutral">Relevance {Math.round(r.relevance_score * 100)}%</Badge><Badge tone="neutral">{r.retrieval_method}</Badge></div>
                <CitationCard citation={r.citation} />
              </div>))}
        </div>)}
    </>
  );
}
