"use client";

import { useState } from "react";
import type { CaseCategory } from "@/lib/api";
import { Badge } from "@/components/ui";
import { SAMPLE_CASE_CONVERSATIONS } from "@/lib/sample-case-conversations";

export function SimilarCasesPanel({ category }: { category: CaseCategory | "" }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!category) return null;
  const examples = SAMPLE_CASE_CONVERSATIONS.filter((item) => item.category === category);
  return (
    <section className="mt-4 rounded-xl2 border border-teal/30 bg-white p-4 shadow-card" aria-label="Illustrative similar cases">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Similar example conversations</h3>
        <Badge tone="amber">Fictional examples</Badge>
      </div>
      <p className="mt-1 text-xs text-navy/70">These are invented demonstrations of how ordinary users may explain a problem over several messages. They are not actual client records, judgments or legal outcomes.</p>
      <ul className="mt-3 space-y-3">
        {examples.map((item) => (
          <li key={item.id} className="rounded-lg bg-ivory/70 p-3">
            <h4 className="text-sm font-semibold">{item.title}</h4>
            <p className="mt-1 text-sm text-navy/80">{item.summary}</p>
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-teal-800 underline underline-offset-2"
              aria-expanded={expanded === item.id}
              onClick={() => setExpanded((current) => current === item.id ? null : item.id)}
            >
              {expanded === item.id ? "Hide conversation" : `Read ${item.turns.length} example messages`}
            </button>
            {expanded === item.id && (
              <ol className="mt-3 space-y-2 border-l-2 border-teal/20 pl-3">
                {item.turns.map((turn, index) => (
                  <li key={index} className="rounded-lg bg-white p-3 text-sm">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy/60">{turn.role === "user" ? "User" : "Legal Aid assistant"}</p>
                    <p className="whitespace-pre-wrap">{turn.content}</p>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
