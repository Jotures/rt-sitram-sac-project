type StatusTone = "neutral" | "success" | "info" | "warning" | "risk" | "critical";

interface StatusChipProps {
  readonly label: string;
  readonly tone?: StatusTone;
}

export function StatusChip({ label, tone = "neutral" }: StatusChipProps): React.JSX.Element {
  return (
    <span className={`status-chip status-chip--${tone}`}>
      <span aria-hidden="true" className="status-chip__dot" />
      {label}
    </span>
  );
}
