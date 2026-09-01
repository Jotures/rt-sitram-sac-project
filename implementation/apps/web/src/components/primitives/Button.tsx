import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { Icon, type IconName } from "./Icon";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly icon?: IconName;
  readonly variant?: ButtonVariant;
}

export function Button({
  children,
  className = "",
  icon,
  type = "button",
  variant = "primary",
  ...props
}: PropsWithChildren<ButtonProps>): React.JSX.Element {
  return (
    <button className={`button button--${variant} ${className}`.trim()} type={type} {...props}>
      {icon === undefined ? null : <Icon name={icon} size={18} />}
      <span>{children}</span>
    </button>
  );
}
