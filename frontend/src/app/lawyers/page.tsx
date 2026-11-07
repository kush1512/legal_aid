"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BadgeCheck, MapPin, Search, Users } from "lucide-react";
import { api, type CaseCategory, type Lawyer } from "@/lib/api";
import { CATEGORIES, INDIAN_STATES, LANGUAGES, categoryShort, languageLabel } from "@/lib/constants";
import { isMock } from "@/lib/config";
import { useAsync } from "@/lib/hooks/useAsync";
import { LAWYER_EXTRAS } from "@/lib/mock/demo-extras";
import { Badge, EmptyState, ErrorState, Field, LoadingBlock, Notice, PageHeader, inputCls } from "@/components/ui";

export default function LawyersPage() {
  const [text, setText] = useState(""); const [category, setCategory] = useState<CaseCategory | "">("");
  const [state, setState] = useState(""); const [city, setCity] = useState(""); const [language, setLanguage] = useState("");
  const [jurisdiction, setJurisdiction] = useState(""); const [minYears, setMinYears] = useState(0); const [feesOnly, setFeesOnly] = useState(false);
  const res = useAsync(() => api.listLawyers({ category: category || undefined, state: state || undefined, city: city.trim() || undefined, language: language || undefined, limit: 100 }), [category, state, city, language]);

  const items = useMemo(() => (res.data?.items ?? []).filter((l) => {
    const t = text.trim().toLowerCase();
    if (t && !`${l.display_name} ${l.bio ?? ""} ${l.city ?? ""}`.toLowerCase().includes(t)) return false;
    if (jurisdiction && !l.jurisdictions.some((j) => j.toLowerCase().includes(jurisdiction.toLowerCase()))) return false;
    if (isMock) { const x = LAWYER_EXTRAS[l.id]; if (minYears && (x?.experience_years ?? 0) < minYears) return false; if (feesOnly && !x?.fee_note) return false; }
    return true;
  }), [res.data, text, jurisdiction, minYears, feesOnly]);

  return (
    <>
      <PageHeader title="Find a lawyer" subtitle="Only lawyers whose credentials have been verified are listed. Browsing doesn’t share anything about your case." />
      <form role="search" onSubmit={(e) => e.preventDefault()} className="mb-5 space-y-3 rounded-xl2 border border-navy/10 bg-white p-4 shadow-card">
        <Field id="ltxt" label="Search by name or keyword"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-navy/50" aria-hidden /><input id="ltxt" className={`${inputCls} pl-9`} value={text} onChange={(e) => setText(e.target.value)} /></div></Field>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="lpa" label="Practice area"><select id="lpa" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as CaseCategory | "")}><option value="">Any</option>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
          <Field id="lst" label="State"><select id="lst" className={inputCls} value={state} onChange={(e) => setState(e.target.value)}><option value="">Any</option>{INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field id="lci" label="City"><input id="lci" className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} /></Field>
          <Field id="lju" label="Court or jurisdiction" hint="e.g. Gauhati High Court"><input id="lju" className={inputCls} value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} /></Field>
          <Field id="lla" label="Language"><select id="lla" className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)}><option value="">Any</option>{LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select></Field>
          <Field id="lex" label="Minimum experience" hint={isMock ? undefined : "Not provided by the API yet"}>
            <select id="lex" className={inputCls} disabled={!isMock} value={minYears} onChange={(e) => setMinYears(Number(e.target.value))}><option value={0}>Any</option><option value={5}>5+ years</option><option value={10}>10+ years</option><option value={15}>15+ years</option></select></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-teal-600" disabled={!isMock} checked={feesOnly} onChange={(e) => setFeesOnly(e.target.checked)} />Only show lawyers who disclose fees{!isMock && <span className="text-xs text-navy/60"> (not provided by the API yet)</span>}</label>
      </form>
      {isMock && <Notice tone="mock" className="mb-4">Experience, fees and recommendations on this page are demonstration data.</Notice>}

      {res.loading ? <LoadingBlock rows={3} /> : res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : items.length === 0 ? <EmptyState icon={Users} title="No lawyers match">Try widening your filters, such as removing the city or language.</EmptyState> : (
        <>
          <p className="mb-2 text-sm text-navy/70" aria-live="polite">{items.length} verified {items.length === 1 ? "lawyer" : "lawyers"}</p>
          <ul className="space-y-3">{items.map((l) => <LawyerCard key={l.id} l={l} />)}</ul>
        </>)}
    </>
  );
}

function LawyerCard({ l }: { l: Lawyer }) {
  const x = isMock ? LAWYER_EXTRAS[l.id] : undefined;
  return (
    <li><Link href={`/lawyers/${l.id}`} className="block rounded-xl2 border border-navy/10 bg-white p-4 shadow-card hover:border-teal/60">
      <div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-lg font-semibold">{l.display_name}</h3>{l.verification_status === "verified" && <Badge tone="teal" icon={BadgeCheck}>Verified</Badge>}</div>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-navy/80">
        {(l.city || l.state) && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{[l.city, l.state].filter(Boolean).join(", ")}</span>}
        <span>{l.languages.map(languageLabel).join(", ")}</span>
        {x && <span>{x.experience_years} yrs experience</span>}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">{l.practice_areas.map((a) => <Badge key={a} tone="mist">{categoryShort(a)}</Badge>)}</div>
      {l.bio && <p className="mt-2 line-clamp-2 text-sm text-navy/85">{l.bio}</p>}
      {x && <p className="mt-2 text-xs text-navy/70">{x.fee_note} · {x.friend_recommendations} recommendations from your network (demo)</p>}
    </Link></li>
  );
}
