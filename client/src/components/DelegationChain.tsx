import { ChevronRight } from "lucide-react";

interface DelegationChainProps {
  workerCount: number;
}

function Pill({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${color}`}
    >
      {label}
    </span>
  );
}

export function DelegationChain({ workerCount }: DelegationChainProps) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      <Pill label="VoiceAgent" color="bg-purple-500/20 text-purple-300" />
      <ChevronRight className="w-3 h-3 opacity-40 shrink-0" />
      <Pill label="Coordinator" color="bg-blue-500/20 text-blue-300" />
      <ChevronRight className="w-3 h-3 opacity-40 shrink-0" />
      <Pill
        label={`${workerCount} worker${workerCount !== 1 ? "s" : ""}`}
        color="bg-green-500/20 text-green-300"
      />
    </div>
  );
}
