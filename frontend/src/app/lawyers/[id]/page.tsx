"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, BadgeCheck, CalendarClock, Languages, MapPin, MessageSquareLock, ShieldCheck, Users } from "lucide-react";
import { api } from "@/lib/api";
import { categoryLabel, languageLabel } from "@/lib/constants";
import { useAsync } from "@/lib/hooks/useAsync";
import { LAWYER_EXTRAS } from "@/lib/mock/demo-extras";
import { SEED_LAWYERS } from "@/lib/mock/data";
import { MessageDialog } from "@/components/MessageDialog";
import { Badge, Button, Card, ErrorState, LoadingBlock, Notice, PrivacyHint } from "@/components/ui";

const NP = <span className="text-navy/60">Not provided yet</span>;

export default function LawyerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const demoLawyer = SEED_LAWYERS.find((lawyer) => lawyer.id === id);
  const isDemoProfile = Boolean(demoLawyer);
  const r = useAsync(() => demoLawyer ? Promise.resolve({ lawyer: demoLawyer }) : api.getLawyer(id), [id]);
  const [dm, setDm] = useState(false);
  return (
    <>
      <Link href="/lawyers" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700"><ArrowLeft className="h-4 w-4" aria-hidden />All lawyers</Link>
      {r.loading ? <LoadingBlock rows={3} /> : r.error || !r.data ? <ErrorState error={r.error} onRetry={r.reload} /> : (() => {
        const l = r.data.lawyer; const x = isDemoProfile ? LAWYER_EXTRAS[l.id] : undefined;
        return (
          <article className="space-y-6">
            <header className="space-y-2">
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold sm:text-3xl">{l.display_name}</h1>
                {isDemoProfile ? <Badge tone="amber">Demo · fictional · not verified</Badge> : l.verification_status === "verified" ? <Badge tone="teal" icon={BadgeCheck}>Verified</Badge> : <Badge tone="amber">Verification {l.verification_status}</Badge>}</div>
              <p className="flex items-center gap-1 text-navy/80"><MapPin className="h-4 w-4" aria-hidden />{[l.city, l.state].filter(Boolean).join(", ") || "Location not provided"}</p>
              {l.bio && <p className="max-w-2xl text-sm leading-relaxed">{l.bio}</p>}
            </header>
            {isDemoProfile && <Notice tone="mock">Fictional demonstration persona. This is not a real lawyer; credentials, enrolment details, experience, fees, portfolio and recommendations are synthetic and have not been verified. Do not contact or rely on this profile for legal representation.</Notice>}

            <div className="grid gap-4 md:grid-cols-2">
              <Card as="section" aria-labelledby="cred"><h2 id="cred" className="mb-2 flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-teal-700" aria-hidden />Verification and credentials</h2>
                <dl className="space-y-2 text-sm">
                  <div><dt className="text-navy/60">Status</dt><dd className="font-medium">{isDemoProfile ? "Demo profile — not verified" : l.verification_status}</dd></div>
                  <div><dt className="text-navy/60">Bar Council enrolment</dt><dd className="font-medium">{isDemoProfile ? "Demo placeholder — no real enrolment" : l.bar_council_enrolment ?? NP}</dd></div>
                  <div><dt className="text-navy/60">Courts and jurisdictions</dt><dd className="font-medium">{l.jurisdictions.length ? l.jurisdictions.join(", ") : NP}</dd></div>
                  <div><dt className="text-navy/60">Experience</dt><dd className="font-medium">{x ? `${x.experience_years} years (demo)` : NP}</dd></div></dl></Card>
              <Card as="section" aria-labelledby="prac"><h2 id="prac" className="mb-2 text-lg font-semibold">Practice and languages</h2>
                <div className="flex flex-wrap gap-1.5">{l.practice_areas.map((a) => <Badge key={a} tone="mist">{categoryLabel(a)}</Badge>)}</div>
                <p className="mt-3 flex items-center gap-2 text-sm"><Languages className="h-4 w-4 text-teal-700" aria-hidden />{l.languages.map(languageLabel).join(", ") || "Not provided"}</p>
                <p className="mt-2 flex items-center gap-2 text-sm"><CalendarClock className="h-4 w-4 text-teal-700" aria-hidden />{x ? `${x.availability} (demo)` : NP}</p>
                <p className="mt-2 text-sm"><span className="text-navy/60">Disclosed fees: </span>{x ? `${x.fee_note} (demo)` : NP}</p></Card>
            </div>

            <Card as="section" aria-labelledby="port"><h2 id="port" className="mb-1 text-lg font-semibold">Anonymised matter portfolio</h2>
              <p className="mb-3 text-xs text-navy/70">Illustrative fictional examples only; not actual client matters or outcomes.</p>
              {x ? <ul className="space-y-2">{x.portfolio.map((m, i) => <li key={i} className="rounded-lg bg-ivory/70 p-3 text-sm"><span className="font-semibold">{m.title}</span><span className="block text-navy/80">{m.outcome}</span></li>)}</ul> : <p className="text-sm">{NP}</p>}</Card>

            <Card as="section" aria-labelledby="rec"><h2 id="rec" className="mb-1 flex items-center gap-2 text-lg font-semibold"><Users className="h-5 w-5 text-teal-700" aria-hidden />Recommended by your network</h2>
              {x ? <p className="text-sm"><strong>{x.friend_recommendations}</strong> illustrative recommendations (demo data).</p> : <p className="text-sm">{NP}</p>}
              <PrivacyHint>Only a total is shown. Who recommended is never revealed to you, and who you recommend is never revealed to others.</PrivacyHint></Card>

            {isDemoProfile && !isMock ? (
              <Notice tone="mock">Private messaging is disabled for demo profiles.</Notice>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button icon={MessageSquareLock} onClick={() => setDm(true)}>Send a private message</Button>
                <PrivacyHint>No case details are shared unless you choose to include them.</PrivacyHint>
              </div>
            )}
            {(!isDemoProfile || isMock) && <MessageDialog open={dm} onClose={() => setDm(false)} threadKey={`lawyer:${l.id}`} title={l.display_name} />}
          </article>);
      })()}
    </>
  );
}
