import { useState } from "react";
import { Card, CardContent, Button } from "@pipecat-ai/voice-ui-kit";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { ResearchResult } from "../types";

interface ResearchCardProps {
  result: ResearchResult;
}

function cleanSummary(raw: string): string {
  // Strip markdown code fences and JSON wrapper artifacts that workers sometimes return
  let text = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  try {
    const parsed = JSON.parse(text);
    if (parsed.summary) return parsed.summary;
  } catch {
    // not JSON, use as-is
  }
  return text.trim();
}

export function ResearchCard({ result }: ResearchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const summary = cleanSummary(result.summary);

  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-muted/50 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <h4 className="text-sm font-semibold">{result.topic}</h4>
          {expanded ? (
            <ChevronUp className="w-4 h-4 shrink-0 opacity-50" />
          ) : (
            <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
          )}
        </button>
        {expanded && (
          <div className="px-4 pb-4 flex flex-col gap-2">
            <p className="text-sm opacity-80 leading-relaxed whitespace-pre-wrap">
              {summary}
            </p>
            {result.sources.length > 0 && (
              <div className="mt-1">
                <h5 className="text-xs font-medium opacity-60 mb-1">Sources</h5>
                <ul className="space-y-0.5">
                  {result.sources.map((source, i) => (
                    <li key={i}>
                      <a
                        href={source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs opacity-60 hover:opacity-100 flex items-center gap-1 truncate"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        {source}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
