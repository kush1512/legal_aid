"use client";
import { useState } from "react";
import { BriefcaseBusiness, Plus } from "lucide-react";
import { api, type CaseCategory, type CaseStatus } from "@/lib/api";
import { CATEGORIES, STATUS_META } from "@/lib/constants";
import { useAsync } from "@/lib/hooks/useAsync";
import { Button, EmptyState, ErrorState, LoadingBlock, PageHeader, inputCls } from "@/components/ui";
import { CaseCard } from "@/components/domain";

export default function CasesPage() {
  const [category, setCategory] = useState<CaseCategory | "">("");
  const [status, setStatus] = useState<CaseStatus | "">("");
  const [offset, setOffset] = useState(0);
  const limit = 10;
  const res = useAsync(() => api.listCases({ category: category || undefined, status: status || undefined, limit, offset }), [category, status, offset]);

  return (
    <>
      <PageHeader title="My cases" subtitle="Only you can see these. Open a case to see its assessment, timeline, documents and conversation."
        actions={<Button href="/case/new" icon={Plus}>New case</Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="f-cat" className="sr-only">Filter by category</label>
          <select id="f-cat" className={inputCls} value={category} onChange={(e) => { setOffset(0); setCategory(e.target.value as CaseCategory | ""); }}>
            <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
        <div><label htmlFor="f-status" className="sr-only">Filter by status</label>
          <select id="f-status" className={inputCls} value={status} onChange={(e) => { setOffset(0); setStatus(e.target.value as CaseStatus | ""); }}>
            <option value="">All statuses</option>{(Object.keys(STATUS_META) as CaseStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</select></div>
      </div>
      {res.loading ? <LoadingBlock /> : res.error ? <ErrorState error={res.error} onRetry={res.reload} /> :
        res.data && res.data.items.length ? (
          <>
            <ul className="space-y-3">{res.data.items.map((c) => <CaseCard key={c.id} c={c} />)}</ul>
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-navy/70">Showing {offset + 1}–{offset + res.data.items.length} of {res.data.page.total}</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</Button>
                <Button variant="secondary" size="sm" disabled={!res.data.page.has_more} onClick={() => setOffset(offset + limit)}>Next</Button>
              </div>
            </div>
          </>
        ) : <EmptyState icon={BriefcaseBusiness} title={category || status ? "No cases match these filters" : "No cases yet"}
            action={category || status ? <Button variant="secondary" onClick={() => { setCategory(""); setStatus(""); }}>Clear filters</Button> : <Button href="/case/new">Start a case</Button>}>
            {category || status ? "Try removing a filter." : "When you start a case it will appear here, visible only to you."}</EmptyState>}
    </>
  );
}
