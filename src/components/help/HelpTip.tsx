"use client";

import { CircleHelp } from "lucide-react";

import { Popover } from "@/components/ui/Overlay";
import { GLOSSARY, type GlossaryKey } from "@/lib/help";

/** A small "?" next to a label that explains the term in plain language. */
export default function HelpTip({ term }: { term: GlossaryKey }) {
  const entry = GLOSSARY[term];
  return (
    <span className="inline-flex align-middle">
      <Popover
        align="start"
        width="w-72"
        label={entry.term}
        trigger={(props) => (
          <button type="button" {...props} className="ml-1 inline-flex rounded-full text-ink-subtle hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label={`What is ${entry.term}?`}>
            <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      >
        <div className="p-3 text-left normal-case tracking-normal">
          <p className="text-sm font-semibold text-ink-strong">{entry.term}</p>
          <p className="mt-1 text-caption font-normal leading-relaxed text-ink">{entry.definition}</p>
        </div>
      </Popover>
    </span>
  );
}
