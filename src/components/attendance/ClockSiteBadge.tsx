import { MapPin } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { mapLink } from "@/lib/geolocation";
import type { ClockPosition, ClockSiteCheck } from "@/types/attendance";

const LABELS: Record<ClockSiteCheck, string> = { ON_SITE: "On site", OFF_SITE: "Off site", NO_POSITION: "No location" };
const TONES: Record<ClockSiteCheck, "success" | "warning" | "neutral"> = { ON_SITE: "success", OFF_SITE: "warning", NO_POSITION: "neutral" };

function distance(metres: number) {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`;
}

/** Where a clock-in or clock-out happened, when the work location checks it. Renders nothing otherwise. */
export default function ClockSiteBadge({ site, position, showLink = false }: { site: ClockSiteCheck | "" | undefined; position?: ClockPosition | null; showLink?: boolean }) {
  if (!site) return null;
  const title = position ? `${distance(position.distance_m)} from ${position.location}${position.accuracy_m ? ` (±${position.accuracy_m} m)` : ""}` : site === "NO_POSITION" ? "Location wasn't shared when clocking" : undefined;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge size="sm" tone={TONES[site]} icon={MapPin} title={title}>{LABELS[site]}{site === "OFF_SITE" && position ? ` · ${distance(position.distance_m)}` : ""}</Badge>
      {showLink && position && <a href={mapLink(position.lat, position.lng)} target="_blank" rel="noopener noreferrer" className="text-caption font-semibold text-primary-ink hover:underline">Map</a>}
    </span>
  );
}
