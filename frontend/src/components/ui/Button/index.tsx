import "./styles.css";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "ghost" | "primary" | "success" | "danger" | "warning" | "link";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "ghost", size, className, ...props }: ButtonProps) {
  const cls = ["btn", `btn-${variant}`, size === "md" ? "btn-md" : "", className]
    .filter(Boolean)
    .join(" ");
  return <button className={cls} {...props} />;
}
