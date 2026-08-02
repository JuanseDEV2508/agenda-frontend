"use client";

import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300 dark:disabled:bg-brand-900",
  secondary:
    "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700",
  outline:
    "border border-zinc-300 bg-[var(--surface)] text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800",
  ghost: "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
  /* Acción destructiva: no depende sólo del color, siempre lleva icono o texto explícito. */
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-300 dark:disabled:bg-rose-900",
  link: "text-brand-700 underline underline-offset-4 hover:text-brand-800 dark:text-brand-300",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-base",
  icon: "size-9 justify-center",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    isLoading = false,
    asChild = false,
    disabled,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  const classes = cn(
    "inline-flex items-center rounded-lg font-medium transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-70",
    VARIANTS[variant],
    SIZES[size],
    className,
  );

  /*
   * Con `asChild` el estilo se fusiona sobre el hijo (normalmente un <Link>).
   * `Slot` exige EXACTAMENTE un hijo, así que aquí no se puede añadir ningún
   * elemento hermano: ni siquiera un `null` condicional, porque React lo cuenta
   * como un segundo hijo y Radix lanza "Slot failed to slot onto its children".
   * Por eso el indicador de carga sólo existe en la variante <button>.
   */
  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      // `isLoading` bloquea el botón: previene envíos múltiples (§6.1).
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={classes}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
});
