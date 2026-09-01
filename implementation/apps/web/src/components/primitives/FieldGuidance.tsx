import type { ReactNode } from "react";

export interface FieldGuidanceProps {
  /**
   * Give the related input this value through aria-describedby. The component
   * does not own the input so it remains compatible with native controls.
   */
  readonly id: string;
  readonly help?: ReactNode;
  readonly example?: ReactNode;
  readonly error?: ReactNode;
  readonly className?: string;
}

/**
 * Presents field-level help, an example, and a validation message in a stable
 * order. It deliberately never uses placeholder text as the only guidance.
 */
export function FieldGuidance({
  id,
  help,
  example,
  error,
  className = "",
}: FieldGuidanceProps): React.JSX.Element | null {
  const hasHelp = help !== undefined && help !== null;
  const hasExample = example !== undefined && example !== null;
  const hasError = error !== undefined && error !== null;

  if (!hasHelp && !hasExample && !hasError) return null;

  return (
    <div className={["field-guidance", className].filter(Boolean).join(" ")} id={id}>
      {hasHelp ? <p className="field-guidance__help">{help}</p> : null}
      {hasExample ? (
        <p className="field-guidance__example">
          <strong>Ejemplo:</strong> {example}
        </p>
      ) : null}
      {hasError ? (
        <p className="field-guidance__error" role="alert">
          <span className="sr-only">Error: </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
