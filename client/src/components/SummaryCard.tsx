import { Card, CardContent } from "@pipecat-ai/voice-ui-kit";
import type { SummaryData } from "../types";

interface SummaryCardProps {
  summary: SummaryData;
}

export function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <h3 className="text-base font-semibold">Research Summary</h3>
        <p className="text-sm leading-relaxed opacity-80">{summary.summary}</p>
        {summary.keyFindings.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Key Findings</h4>
            <ul className="space-y-1">
              {summary.keyFindings.map((finding, i) => (
                <li key={i} className="text-sm opacity-80 flex gap-2">
                  <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                  {finding}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
