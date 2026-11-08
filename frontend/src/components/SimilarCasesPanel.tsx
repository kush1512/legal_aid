"use client";
import type { CaseCategory } from "@/lib/api";
import { Badge } from "@/components/ui";

const EXAMPLES: Record<CaseCategory, Array<{ title: string; summary: string; themes: string[] }>> = {
  property_real_estate: [
    { title: "Buyer disputes land ownership after payment", summary: "A buyer says payment was made but the seller later disputes the transaction.", themes: ["Sale deed", "Payment evidence", "Title records"] },
    { title: "Possession not handed over after purchase", summary: "The buyer has an agreement but has not received possession of the property.", themes: ["Possession", "Agreement terms", "Correspondence"] },
    { title: "Property agreement registration is disputed", summary: "The parties disagree about the effect of an unregistered property agreement.", themes: ["Registration", "Agreement", "Evidence"] }
  ],
  marriage_family: [
    { title: "Disagreement about child arrangements", summary: "Parents need to understand the information relevant to child-care arrangements.", themes: ["Child welfare", "Existing orders", "Safety"] },
    { title: "Maintenance and financial support query", summary: "A person is seeking information about financial support after separation.", themes: ["Income records", "Expenses", "Family proceedings"] },
    { title: "Shared household and belongings dispute", summary: "A family member is seeking guidance about belongings and residence-related concerns.", themes: ["Residence", "Property records", "Safety"] }
  ],
  digital_fraud_cybercrime: [
    { title: "Unauthorised UPI transaction", summary: "A person notices a transfer they did not initiate.", themes: ["Bank complaint", "Transaction ID", "1930"] },
    { title: "Impersonation through a social account", summary: "Someone is using another person's identity or photographs online.", themes: ["Screenshots", "Platform report", "Cyber complaint"] },
    { title: "Online purchase or payment scam", summary: "A seller or unknown account has taken payment without providing the promised service.", themes: ["Payment proof", "Messages", "Complaint reference"] }
  ],
  personal_safety_privacy: [
    { title: "Repeated unwanted contact", summary: "A person is receiving repeated unwanted messages or visits.", themes: ["Safety planning", "Dated records", "Support services"] },
    { title: "Private images shared without consent", summary: "A person wants to understand evidence preservation and reporting options.", themes: ["Evidence preservation", "Platform reporting", "Safety"] },
    { title: "Threats or harassment", summary: "A person is documenting threatening conduct and considering support options.", themes: ["Immediate safety", "Incident timeline", "Support"] }
  ]
};

export function SimilarCasesPanel({ category }: { category: CaseCategory | "" }) {
  if (!category) return null;
  return (
    <section className="mt-4 rounded-xl2 border border-teal/30 bg-white p-4 shadow-card" aria-label="Illustrative similar cases">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Similar example cases</h3>
        <Badge tone="amber">Illustrative only</Badge>
      </div>
      <p className="mt-1 text-xs text-navy/70">Examples are matched by category, not by legal outcome. They are fictional scenarios, not judgments or actual user cases.</p>
      <ul className="mt-3 space-y-3">
        {EXAMPLES[category].map((item) => (
          <li key={item.title} className="rounded-lg bg-ivory/70 p-3">
            <h4 className="text-sm font-semibold">{item.title}</h4>
            <p className="mt-1 text-sm text-navy/80">{item.summary}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{item.themes.map((theme) => <span key={theme} className="rounded-full bg-mist px-2 py-1 text-xs text-teal-800">{theme}</span>)}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
