import { useResearchState } from "../context/ResearchContext";
import { ResearchCard } from "./ResearchCard";
import { SummaryCard } from "./SummaryCard";

export function ResearchPanel() {
  const { summary, researchResults } = useResearchState();

  if (!summary && researchResults.length === 0) {
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
      {summary && <SummaryCard summary={summary} />}
      {researchResults.map((result, i) => (
        <ResearchCard key={`${result.groupId}-${result.taskId}-${i}`} result={result} />
      ))}
    </div>
  );
}
