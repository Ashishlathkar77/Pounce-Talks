import { Badge } from "@/components/ui/badge";

interface OutcomeBadgeProps {
  outcome: string;
}

export default function OutcomeBadge({ outcome }: OutcomeBadgeProps) {
  const variants: Record<string, "success" | "destructive" | "warning" | "default"> = {
    booked:      "success",
    accepted:    "success",     // UI alias
    declined:    "destructive",
    transferred: "warning",
    dropped:     "default",
    no_answer:   "default",
    voicemail:   "default",
    pending:     "default",
  };

  const labels: Record<string, string> = {
    booked:      "Accepted",    // DB value → human label
    accepted:    "Accepted",
    declined:    "Declined",
    transferred: "Transferred",
    dropped:     "Dropped",
    no_answer:   "No Answer",
    voicemail:   "Voicemail",
    pending:     "Pending",
  };

  return (
    <Badge variant={variants[outcome] ?? "default"}>
      {labels[outcome] ?? outcome}
    </Badge>
  );
}
