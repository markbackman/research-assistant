import { useState } from "react";
import { Card, CardContent, Button } from "@pipecat-ai/voice-ui-kit";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { ResearchResult } from "../types";

interface ResearchCardProps {
  result: ResearchResult;
}

export function ResearchCard({ result }: ResearchCardProps) {
  const [expanded, setExpanded] = useState(false);

  const truncatedSummary =
    result.summary.length > 200 && !expanded
      ? result.summary.slice(0, 200) + "..."
      : result.summary;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold">{result.topic}</h4>
          {result.summary.length > 200 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
        <p className="text-sm opacity-80 leading-relaxed whitespace-pre-wrap">
          {truncatedSummary}
        </p>
        {result.sources.length > 0 && (expanded || result.summary.length <= 200) && (
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
      </CardContent>
    </Card>
  );
}
