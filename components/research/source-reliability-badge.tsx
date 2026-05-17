import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  sourceReliabilityInfo,
  type SourceReliabilityKind,
} from "@/lib/source-reliability";

const badgeTone: Record<SourceReliabilityKind, BadgeTone> = {
  primary_source: "high",
  ocr_text: "accent",
  curated_metadata: "muted",
  evidence_record: "medium",
  research_lead: "low",
  external_reference: "outline",
  derived_signal: "neutral",
};

export function SourceReliabilityBadge({
  kind,
  size = "sm",
}: {
  kind: SourceReliabilityKind;
  size?: "sm" | "md";
}) {
  const info = sourceReliabilityInfo(kind);
  return (
    <Badge tone={badgeTone[info.kind]} size={size} style={{ letterSpacing: 0 }}>
      <span title={info.description}>{info.label}</span>
    </Badge>
  );
}
