import { useState } from "react";
import { Card, CardContent } from "@pipecat-ai/voice-ui-kit";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useResearchState } from "../context/ResearchContext";
import { ResearchCard } from "./ResearchCard";
import type { SummaryData, ResearchResult } from "../types";

export function ResearchPanel() {
  const { taskGroups, summaries, researchResults } = useResearchState();

  // Only show groups that have results or a summary
  const groupsWithContent = taskGroups.filter(
    (g) =>
      summaries[g.groupId] ||
      researchResults.some((r) => r.groupId === g.groupId)
  );

  if (groupsWithContent.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm opacity-50 text-center">
          Ask me to research any topic and results will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {groupsWithContent.map((group) => (
        <ResearchGroupCard
          key={group.groupId}
          query={group.query}
          summary={summaries[group.groupId] ?? null}
          results={researchResults.filter((r) => r.groupId === group.groupId)}
        />
      ))}
    </div>
  );
}

function ResearchGroupCard({
  query,
  summary,
  results,
}: {
  query: string;
  summary: SummaryData | null;
  results: ResearchResult[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold">{query}</h3>
            {expanded ? (
              <ChevronUp className="w-4 h-4 shrink-0 opacity-50" />
            ) : (
              <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
            )}
          </div>

          {/* Key findings — always visible */}
          {summary && summary.keyFindings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {summary.keyFindings.map((finding, i) => (
                <li key={i} className="text-sm opacity-80 flex gap-2">
                  <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                  {finding}
                </li>
              ))}
            </ul>
          )}

          {/* Source count hint */}
          <p className="mt-2 text-xs opacity-40">
            {results.length} subtopic{results.length !== 1 && "s"} ·{" "}
            {results.reduce((n, r) => n + r.sources.length, 0)} sources
          </p>
        </button>

        {/* Expanded: full summary + per-worker results */}
        {expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-border">
            {summary && (
              <p className="text-sm leading-relaxed opacity-80 pt-3">
                {summary.summary}
              </p>
            )}
            {results.map((result, i) => (
              <ResearchCard key={`${result.taskId}-${i}`} result={result} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
