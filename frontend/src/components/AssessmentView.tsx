"use client";
import Link from "next/link";
import { AlertOctagon, CircleHelp, Gavel, MessagesSquare, Scale, UserCheck } from "lucide-react";
import { api, type Case, type CaseAssessment } from "@/lib/api";
import { EMERGENCY_NOTE, categoryShort } from "@/lib/constants";
import { useAsync } from "@/lib/hooks/useAsync";
import { Badge, Card, EmptyState, LoadingBlock, Notice } from "./ui";
import { CitationCard, LegalDisclaimer, MockAiBadge } from "./domain";

function Section({ title, icon: Icon, children, id }: { title: string; icon?: React.ElementType; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h3 id={id} className="flex items-center gap-2 text-lg font-semibold">{Icon && <Icon className="h-5 w-5 text-teal-700" aria-hidden />}{title}</h3>
      {children}
    </section>
  );
}
const List = ({ items, empty }: { items: string[]; empty: string }) =>
  items.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-sm text-navy/70">{empty}</p>;

export function AssessmentView({ c, a, onAskMore }: { c: Case; a: CaseAssessment; onAskMore: () => void }) {
  const uncertaintyTone = a.overall_uncertainty === "high" ? "amber" : a.overall_uncertainty === "medium" ? "neutral" : "teal";
  return (
    <div className="space-y-8">
      {a.escalation_required && (
        <Notice tone="danger" title="This may need urgent human help">
          {a.escalation_reason ?? "The assistant flagged a possible urgent risk."} {EMERGENCY_NOTE} Consider speaking to a lawyer or a local support service today.
        </Notice>
      )}
      <LegalDisclaimer>{a.disclaimer}</LegalDisclaimer>

      <div className="flex flex-wrap items-center gap-2">
        <MockAiBadge isMock={a.model.is_mock} provider={a.model.provider} model={a.model.name} />
        <Badge tone={uncertaintyTone}>Uncertainty: {a.overall_uncertainty}</Badge>
        <Badge tone="neutral">Model confidence: {Math.round(a.confidence * 100)}%</Badge>
      </div>

      <Section id="a-sum" title="Case summary"><p className="text-sm leading-relaxed">{a.summary}</p></Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section id="a-parties" title="Parties">
          {a.parties.length ? <ul className="space-y-2">{a.parties.map((p, i) => <li key={i} className="rounded-xl bg-white p-3 text-sm shadow-card"><span className="font-semibold">{p.name ?? "Unnamed"}</span>{p.role && <span className="text-navy/70"> · {p.role}</span>}{p.description && <p className="text-navy/80">{p.description}</p>}</li>)}</ul> : <p className="text-sm text-navy/70">No parties identified yet.</p>}
        </Section>
        <Section id="a-evid" title="Evidence">
          {a.evidence.length ? <ul className="space-y-2">{a.evidence.map((e, i) => <li key={i} className="rounded-xl bg-white p-3 text-sm shadow-card"><span className="font-semibold">{e.item}</span>{e.status && <Badge tone="mist" className="ml-2">{e.status}</Badge>}{e.relevance && <p className="text-navy/80">{e.relevance}</p>}</li>)}</ul> : <p className="text-sm text-navy/70">No evidence recorded yet.</p>}
        </Section>
      </div>

      <Section id="a-time" title="Timeline">
        {a.timeline.length ? <ol className="space-y-2 border-l-2 border-teal/40 pl-4">{a.timeline.map((t, i) => (
          <li key={i} className="text-sm"><span className="font-semibold">{t.date ?? "Date not stated"}</span><p>{t.event}</p><p className="text-xs text-navy/60">Source: {t.source.replace("_", " ")}</p></li>))}</ol> : <p className="text-sm text-navy/70">No dated events yet. Add dates in the conversation.</p>}
      </Section>

      <div className="grid gap-6 md:grid-cols-3">
        <Section id="a-est" title="Facts you stated"><List items={a.established_facts} empty="None recorded yet." /></Section>
        <Section id="a-ass" title="Assumptions"><List items={a.assumptions} empty="None." /></Section>
        <Section id="a-unk" title="Still unknown"><List items={a.unknowns} empty="None." /></Section>
      </div>

      <Section id="a-pos" title="Current position"><Card className="text-sm leading-relaxed">{a.legal_position}</Card></Section>

      <Section id="a-laws" title="Laws that may apply" icon={Gavel}>
        {a.potentially_relevant_laws.length ? <div className="space-y-3">{a.potentially_relevant_laws.map((l, i) => <CitationCard key={i} citation={l.citation} explanation={l.explanation} applicability={l.applicability} />)}</div> :
          <EmptyState title="No verified provisions linked yet">The assistant does not name laws until they have been matched to a verified source. Add more facts, or <Link href="/legal" className="font-semibold text-teal-700 underline">search the law yourself</Link>.</EmptyState>}
      </Section>

      <Section id="a-opt" title="Your options and action plan">
        {a.options.length ? <ol className="space-y-3">{a.options.map((o, i) => (
          <li key={i}><Card className="p-4"><h4 className="font-display text-base font-semibold">{o.title}</h4><p className="mt-1 text-sm">{o.description}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div><p className="text-sm font-semibold">Next steps</p><List items={o.next_steps} empty="—" /></div>
              <div><p className="text-sm font-semibold">Risks to weigh</p><List items={o.risks} empty="None noted." /></div></div>
            {i === 0 && <div className="mt-3"><Link href={`/studio?case=${c.id}`} className="text-sm font-semibold text-teal-700 underline">Draft a document for this case</Link></div>}
          </Card></li>))}</ol> : <p className="text-sm text-navy/70">No options yet; the assistant needs more facts first.</p>}
      </Section>

      {a.follow_up_questions.length > 0 && (
        <Section id="a-fu" title="Questions that would sharpen this" icon={CircleHelp}>
          <List items={a.follow_up_questions} empty="" />
          <button type="button" onClick={onAskMore} className="text-sm font-semibold text-teal-700 underline">Answer in the conversation</button>
        </Section>
      )}

      <Section id="a-judg" title="Similar judgments">
        <Notice tone="info">Similar-judgment matching is not available yet. The backend has no judgments index, so nothing is shown rather than guessing.</Notice>
      </Section>
      <Related c={c} />
    </div>
  );
}

/** Community discussions and lawyers related to the case, fetched from the real list endpoints. */
function Related({ c }: { c: Case }) {
  const posts = useAsync(() => api.listPosts({ category: c.category, limit: 3, sort: "popular" }), [c.category]);
  const lawyers = useAsync(() => api.listLawyers({ category: c.category, state: c.jurisdiction.state, limit: 3 }), [c.category, c.jurisdiction.state]);
  return (
    <>
      <Section id="a-comm" title="Community discussions" icon={MessagesSquare}>
        {posts.loading ? <LoadingBlock rows={1} /> : posts.data?.items.length ? (
          <ul className="space-y-2">{posts.data.items.map((p) => <li key={p.id}><Link href="/community" className="block rounded-xl bg-white p-3 text-sm shadow-card hover:ring-1 hover:ring-teal/50"><span className="font-semibold">{p.title}</span><span className="block text-xs text-navy/70">{p.display_name} · {p.vote_count} votes · {categoryShort(p.category)}</span></Link></li>)}</ul>
        ) : <p className="text-sm text-navy/70">No public discussions in this category yet.</p>}
      </Section>
      <Section id="a-law" title="Recommended lawyers" icon={Scale}>
        {lawyers.loading ? <LoadingBlock rows={1} /> : lawyers.data?.items.length ? (
          <ul className="space-y-2">{lawyers.data.items.map((l) => <li key={l.id}><Link href={`/lawyers/${l.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm shadow-card hover:ring-1 hover:ring-teal/50">
            <span><span className="block font-semibold">{l.display_name}</span><span className="text-xs text-navy/70">{[l.city, l.state].filter(Boolean).join(", ")} · {l.languages.join(", ")}</span></span>
            {l.verification_status === "verified" && <Badge tone="teal" icon={UserCheck}>Verified</Badge>}</Link></li>)}</ul>
        ) : <p className="text-sm text-navy/70">No verified lawyers found for this category and state. <Link href="/lawyers" className="font-semibold text-teal-700 underline">Browse all lawyers</Link>.</p>}
        <p className="text-xs text-navy/70">Listed by category and state only. Sharing case details with a lawyer happens only when you choose to.</p>
      </Section>
    </>
  );
}
