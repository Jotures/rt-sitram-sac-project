import type { ReactNode } from "react";

export interface SectionIntroProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly aside?: ReactNode;
  readonly headingLevel?: 2 | 3;
  readonly className?: string;
}

/**
 * Introduces a form or operational section before its controls. Keep the
 * description concrete: what this section is for and what the user can do.
 */
export function SectionIntro({
  title,
  description,
  eyebrow,
  aside,
  headingLevel = 2,
  className = "",
}: SectionIntroProps): React.JSX.Element {
  const hasDescription = description !== undefined && description !== null;
  const hasEyebrow = eyebrow !== undefined && eyebrow !== null;
  const hasAside = aside !== undefined && aside !== null;
  const titleElement =
    headingLevel === 3 ? (
      <h3 className="section-intro__title">{title}</h3>
    ) : (
      <h2 className="section-intro__title">{title}</h2>
    );

  return (
    <header className={["section-intro", className].filter(Boolean).join(" ")}>
      <div className="section-intro__content">
        {hasEyebrow ? <p className="section-intro__eyebrow">{eyebrow}</p> : null}
        {titleElement}
        {hasDescription ? <p className="section-intro__description">{description}</p> : null}
      </div>
      {hasAside ? <div className="section-intro__aside">{aside}</div> : null}
    </header>
  );
}
