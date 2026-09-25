import { useState } from "react";
import { Check } from "lucide-react";
import { AESTHETICS, ATMOSPHERES, PATTERNS, INVESTMENTS } from "./consultationOptions";
import type { QuizData } from "@/contexts/QuizContext";

interface Props {
  data: QuizData;
  onUpdate: (patch: Partial<QuizData>) => void;
  onAuthorize: () => void;
}

function Radio({ checked, label, onSelect, testId }: { checked: boolean; label: string; onSelect: () => void; testId: string }) {
  return (
    <button type="button" role="radio" aria-checked={checked} onClick={onSelect} className="flex items-center gap-5 text-left py-2 group" data-testid={testId}>
      <span className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-500 ${checked ? "bg-[#4f5344] border-[#4f5344] text-white" : "border-[#231f20]/40 group-hover:border-[#231f20]"}`}>
        {checked && <Check className="w-4 h-4" />}
      </span>
      <span className="text-lg font-light">{label}</span>
    </button>
  );
}

const card = "max-w-5xl mx-auto my-12 md:my-20 bg-[#f7f9f8] shadow-[3px_4px_6px_rgba(0,0,0,0.18)] px-6 md:px-20 py-14";

/** Step 8: Verify System Parameters (p11) with optional Refine Design Parameters (p12). */
export default function ConsultVerifyStep({ data, onUpdate, onAuthorize }: Props) {
  const [refining, setRefining] = useState(false);
  // Draft edits are applied only on "Update"; "Maintain Original" discards them.
  const [draft, setDraft] = useState({
    style: data.styles[0] ?? "",
    atmosphere: data.atmosphere,
    pattern: data.patternPreference,
    budget: data.budgetRange,
  });

  const caption = data.aestheticCaption || AESTHETICS.find((a) => a.style === data.styles[0])?.caption || "";
  const rows: Array<[string, string]> = [
    ["YOUR AESTHETIC", caption],
    ["ATMOSPHERE", data.atmosphere],
    ["VISUAL LAYERING", data.patternPreference],
    ["INVESTMENT", INVESTMENTS.find((b) => b.id === data.budgetRange)?.label ?? data.budgetRange],
  ];

  if (!refining) {
    return (
      <div className="px-4">
        <div className={card} data-testid="verify-card">
          <h2 className="cc-heading text-center">Verify System Parameters</h2>
          <p className="text-center text-lg mt-6 mb-12 font-light">Your design protocol has been generated based on the following architectural snapshot:</p>
          <div>
            {rows.map(([k, v]) => (
              <div className="cc-table-row text-lg" key={k}>
                <div>{k}</div>
                <div>{v}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-8 mt-14">
            <button className="cc-btn" onClick={onAuthorize} data-testid="button-authorize">Authorize</button>
            <button
              className="cc-link"
              onClick={() => {
                setDraft({ style: data.styles[0] ?? "", atmosphere: data.atmosphere, pattern: data.patternPreference, budget: data.budgetRange });
                setRefining(true);
              }}
              data-testid="button-refine"
            >
              Refine your selection
            </button>
          </div>
        </div>
      </div>
    );
  }

  const groups: Array<{ title: string; items: Array<{ key: string; label: string; selected: boolean; select: () => void }> }> = [
    {
      title: "YOUR AESTHETIC",
      items: AESTHETICS.map((a) => ({ key: a.style, label: a.caption, selected: draft.style === a.style, select: () => setDraft({ ...draft, style: a.style }) })),
    },
    {
      title: "ATMOSPHERE",
      items: ATMOSPHERES.map((a) => ({ key: a.id, label: a.refineLabel, selected: draft.atmosphere === a.id, select: () => setDraft({ ...draft, atmosphere: a.id }) })),
    },
    {
      title: "VISUAL LAYERING",
      items: PATTERNS.map((p) => ({ key: p.id, label: p.refineLabel, selected: draft.pattern === p.id, select: () => setDraft({ ...draft, pattern: p.id }) })),
    },
    {
      // Deviation: p12 shows a $12K-$31K+ set that contradicts p10; the p10 bands are reused so stored values stay consistent.
      title: "INVESTMENT",
      items: INVESTMENTS.map((b) => ({ key: b.id, label: b.label, selected: draft.budget === b.id, select: () => setDraft({ ...draft, budget: b.id }) })),
    },
  ];

  return (
    <div className="px-4">
      <div className={card} data-testid="refine-card">
        <h2 className="cc-heading text-center">Refine Design Parameters</h2>
        <p className="text-center text-lg mt-6 mb-12 font-light">Adjust the foundational logic if necessary to align with your final vision.</p>
        <div>
          {groups.map((g) => (
            <div key={g.title} className="cc-table-row text-lg">
              <div>{g.title}</div>
              <div role="radiogroup" aria-label={g.title} className="flex flex-col gap-1">
                {g.items.map((i) => (
                  <Radio key={i.key} checked={i.selected} label={i.label} onSelect={i.select} testId={`refine-${g.title}-${i.key}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-8 mt-14">
          <button
            className="cc-btn"
            data-testid="button-update"
            onClick={() => {
              const persona = AESTHETICS.find((a) => a.style === draft.style);
              onUpdate({
                styles: draft.style ? [draft.style] : [],
                aestheticCaption: persona?.caption ?? "",
                atmosphere: draft.atmosphere,
                patternPreference: draft.pattern,
                budgetRange: draft.budget,
              });
              setRefining(false);
            }}
          >
            Update
          </button>
          <button className="cc-link" onClick={() => setRefining(false)} data-testid="button-maintain-original">Maintain Original</button>
        </div>
      </div>
    </div>
  );
}
