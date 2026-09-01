import { useId, type ReactNode } from "react";

export type GuidanceTone = "info" | "warning";

export interface GuidanceNoteProps {
  readonly children: ReactNode;
  readonly title?: ReactNode;
  readonly tone?: GuidanceTone;
  readonly className?: string;
}

/**
 * Gives contextual orientation without presenting it as an operational state
 * or an error. Use warning only when the user needs to consider a consequence.
 */
export function GuidanceNote({
  children,
  title,
  tone = "info",
  className = "",
}: GuidanceNoteProps): React.JSX.Element {
  const titleId = useId();
  const resolvedTitle = title ?? (tone === "warning" ? "Atención" : "Orientación");

  return (
    <div
      aria-labelledby={titleId}
      className={["guidance-note", `guidance-note--${tone}`, className].filter(Boolean).join(" ")}
      role="note"
    >
      <strong className="guidance-note__title" id={titleId}>
        {resolvedTitle}
      </strong>
      <div className="guidance-note__body">{children}</div>
    </div>
  );
}
