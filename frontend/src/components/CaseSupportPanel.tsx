"use client";

import { useEffect, useState } from "react";
import { api, type CaseCategory, type Lawyer, type LegalSearchItem } from "@/lib/api";
import { categoryLabel } from "@/lib/constants";
import { SEED_LAWYERS } from "@/lib/mock/data";
import { Badge, Button, LoadingBlock } from "@/components/ui";

type CaseInfo = {
  id: string;
  title: string;
  category: CaseCategory;
  jurisdiction?: { state?: string; district?: string; city?: string };
};

type Article = {
  title: string;
  source: string;
  description: string;
  url: string;
  status: string;
  demo: boolean;
};

const CURATED: Record<CaseCategory, Article[]> = {
  property_real_estate: [
    { title: "Transfer of Property Act, 1882", source: "India Code", description: "Central legislation covering transfer of property and related rights and obligations.", url: "https://www.indiacode.nic.in/", status: "Official source · verify applicable provisions", demo: true },
    { title: "Registration Act, 1908", source: "India Code", description: "Central legislation concerning registration of documents, including specified instruments relating to immovable property.", url: "https://www.indiacode.nic.in/", status: "Official source · verify applicable provisions", demo: true },
    { title: "Specific Relief Act, 1963", source: "India Code", description: "Central legislation concerning civil remedies including specific performance, subject to statutory requirements.", url: "https://www.indiacode.nic.in/", status: "Official source · verify applicable provisions", demo: true },
  ],
  digital_fraud_cybercrime: [
    { title: "Information Technology Act, 2000", source: "India Code", description: "Central legislation addressing specified offences and legal issues involving electronic records and computer resources.", url: "https://www.indiacode.nic.in/", status: "Official source · verify applicable provisions", demo: true },
    { title: "Bharatiya Nyaya Sanhita, 2023", source: "India Code", description: "Central criminal legislation that includes provisions concerning cheating and related offences.", url: "https://www.indiacode.nic.in/", status: "Official source · verify applicable provisions", demo: true },
    { title: "National Cyber Crime Reporting Portal", source: "Government of India", description: "Official portal for reporting cybercrime. For suspected financial cyber fraud, call 1930 promptly as well.", url: "https://cybercrime.gov.in/", status: "Official government reporting resource", demo: true },
  ],
  marriage_family: [
    { title: "Hindu Marriage Act, 1955", source: "India Code", description: "Central legislation governing specified aspects of Hindu marriage and matrimonial relief.", url: "https://www.indiacode.nic.in/", status: "Official source · applicability depends on personal law", demo: true },
    { title: "Special Marriage Act, 1954", source: "India Code", description: "Central legislation providing a civil framework for solemnisation and registration of marriages.", url: "https://www.indiacode.nic.in/", status: "Official source · verify applicability", demo: true },
    { title: "Protection of Women from Domestic Violence Act, 2005", source: "India Code", description: "Central legislation providing civil protection and relief mechanisms in qualifying domestic-violence situations.", url: "https://www.indiacode.nic.in/", status: "Official source · verify applicability", demo: true },
  ],
  personal_safety_privacy: [
    { title: "Information Technology Act, 2000", source: "India Code", description: "Central legislation addressing specified offences involving electronic records and computer resources.", url: "https://www.indiacode.nic.in/", status: "Official source · verify applicable provisions", demo: true },
    { title: "Bharatiya Nyaya Sanhita, 2023", source: "India Code", description: "Central criminal legislation that may be relevant to threats, harassment or other offences depending on facts.", url: "https://www.indiacode.nic.in/", status: "Official source · verify applicable provisions", demo: true },
    { title: "National Cyber Crime Reporting Portal", source: "Government of India", description: "Official reporting resource for qualifying cybercrime complaints, including online harassment and image misuse.", url: "https://cybercrime.gov.in/", status: "Official government reporting resource", demo: true },
  ],
};

function articleFromResult(item: LegalSearchItem): Article {
  const c = item.citation;
  return {
    title: [c.act_name, c.section_label, c.title].filter(Boolean).join(" · "),
    source: c.source_url,
    description: c.excerpt,
    url: c.source_url,
    status: c.source_status === "verified" ? "Verified source" : c.source_status === "historical" ? "Historical source" : "Unverified source",
    demo: false,
  };
}

export function CaseSupportPanel({ caseInfo }: { caseInfo: CaseInfo }) {
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [lawyerLoading, setLawyerLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>(CURATED[caseInfo.category]);
  const [articleLoading, setArticleLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLawyerLoading(true);
    const { city, district, state } = caseInfo.jurisdiction ?? {};
    api.listLawyers({ limit: 50, category: caseInfo.category, city: city || district, state })
      .then((result) => {
        if (!active) return;
        const ranked = [...result.items].filter((l) => l.verification_status === "verified").sort((a, b) => {
          const locality = (l: Lawyer) => Number(Boolean(city && l.city?.toLowerCase().includes(city.toLowerCase()))) * 2 + Number(Boolean(state && l.state?.toLowerCase() === state.toLowerCase()));
          return locality(b) - locality(a);
        });
        const demoMatches = SEED_LAWYERS.filter((lawyer) => lawyer.practice_areas.includes(caseInfo.category));
        setLawyers((ranked.length ? ranked : demoMatches).slice(0, 3));
      })
      .catch(() => { if (active) setLawyers([]); })
      .finally(() => { if (active) setLawyerLoading(false); });
    return () => { active = false; };
  }, [caseInfo.category, caseInfo.jurisdiction?.city, caseInfo.jurisdiction?.district, caseInfo.jurisdiction?.state]);

  useEffect(() => {
    let active = true;
    setArticleLoading(true);
    api.searchLegal({ query: caseInfo.title, category: caseInfo.category, jurisdiction: { country: "IN", state: caseInfo.jurisdiction?.state }, limit: 3 })
      .then((result) => {
        if (!active) return;
        const retrieved = result.results.map(articleFromResult);
        const fallback = CURATED[caseInfo.category];
        const seen = new Set(retrieved.map((a) => a.title.toLowerCase()));
        setArticles([...retrieved, ...fallback.filter((a) => !seen.has(a.title.toLowerCase()))].slice(0, 3));
      })
      .catch(() => { if (active) setArticles(CURATED[caseInfo.category]); })
      .finally(() => { if (active) setArticleLoading(false); });
    return () => { active = false; };
  }, [caseInfo.id, caseInfo.title, caseInfo.category, caseInfo.jurisdiction?.state]);

  const allCurated = articles.length > 0 && articles.every((a) => a.demo);
  return (
    <section className="mt-8 space-y-6" aria-label="Additional case support">
      <div className="rounded-xl2 border border-teal/30 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">You should contact a lawyer</h2>
          <Badge tone="amber">General recommendation</Badge>
        </div>
        <p className="mt-1 text-sm text-navy/75">A qualified lawyer can review your documents, jurisdiction and specific facts before you take formal action.</p>
        {lawyerLoading ? <LoadingBlock rows={2} /> : lawyers.length ? (
          <ol className="mt-4 space-y-3">
            {lawyers.map((lawyer) => (
              <li key={lawyer.id} className="rounded-lg border border-navy/10 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{lawyer.display_name}</strong>
                  {lawyer.display_name.includes("(demo)") ? <Badge tone="amber">Demo profile · not a real lawyer</Badge> : <Badge tone="teal">Verified profile</Badge>}
                </div>
                <p className="mt-1 text-xs text-navy/70">{categoryLabel(caseInfo.category)} · {[lawyer.city, lawyer.state].filter(Boolean).join(", ") || "Location not listed"}</p>
                {lawyer.bio && <p className="mt-2 text-sm">{lawyer.bio}</p>}
                {lawyer.jurisdictions.length > 0 && <p className="mt-1 text-xs text-navy/65">Jurisdictions: {lawyer.jurisdictions.join(", ")}</p>}
              </li>
            ))}
          </ol>
        ) : <p className="mt-3 text-sm text-navy/70">No matching lawyer profiles are currently available. Browse the lawyer directory for other listings.</p>}
        <Button href="/lawyers" variant="secondary" className="mt-4">View lawyer directory</Button>
        <p className="mt-2 text-xs text-navy/60">Recommendations are based on listed practice areas and location. Profile verification should be independently confirmed before engagement.</p>
      </div>

      <div className="rounded-xl2 border border-navy/10 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Related legal articles and documents</h2>
          <Badge tone="mist">3 resources</Badge>
        </div>
        <p className="mt-1 text-sm text-navy/70">Selected for {categoryLabel(caseInfo.category)}. These resources are starting points, not a determination that a law applies to your facts.</p>
        {articleLoading ? <LoadingBlock rows={3} /> : (
          <>
            {allCurated && <p className="mt-2 text-xs text-amber-800">Curated demonstration references are shown because live retrieval was unavailable or returned no usable results.</p>}
            <ol className="mt-4 space-y-3">
              {articles.map((article, index) => (
                <li key={article.title + index} className="rounded-lg border border-navy/10 p-3">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone={article.demo ? "amber" : article.status === "Verified source" ? "teal" : "neutral"}>{article.demo ? "Demo reference" : article.status}</Badge><span className="text-xs text-navy/60">{article.source}</span></div>
                  <h3 className="mt-2 font-semibold">{article.title}</h3>
                  <p className="mt-1 text-sm text-navy/75">{article.description}</p>
                  <a className="mt-2 inline-block text-sm font-semibold text-teal-800 underline" href={article.url} target="_blank" rel="noopener noreferrer">Open source</a>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}
