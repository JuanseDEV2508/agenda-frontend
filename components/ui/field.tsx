"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import { AlertCircle } from "lucide-react";
import { forwardRef, useId } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Campo de formulario accesible: etiqueta asociada, descripción y error
 * enlazados con `aria-describedby` / `aria-invalid`.
 */

export function Label({
  className,
  required,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }) {
  return (
    <LabelPrimitive.Root
      className={cn("text-sm font-medium text-zinc-800 dark:text-zinc-200", className)}
      {...props}
    >
      {children}
      {required ? (
        <span className="ml-0.5 text-rose-600 dark:text-rose-400" aria-hidden="true">
          *
        </span>
      ) : null}
      {required ? <span className="sr-only"> (obligatorio)</span> : null}
    </LabelPrimitive.Root>
  );
}

export interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  description?: React.ReactNode;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  required,
  description,
  error,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      ) : null}
      {children}
      {description && !error ? (
        <p className="text-xs text-[var(--text-muted)]">{description}</p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="flex items-start gap-1 text-xs font-medium text-rose-700 dark:text-rose-400"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

const CONTROL_CLASSES =
  "w-full rounded-lg border border-zinc-300 bg-[var(--surface)] px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 aria-[invalid=true]:border-rose-500 dark:border-zinc-700 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:disabled:bg-zinc-800";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CONTROL_CLASSES, "h-10", className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 3, ...props }, ref) {
  return (
    <textarea ref={ref} rows={rows} className={cn(CONTROL_CLASSES, className)} {...props} />
  );
});

/**
 * Select nativo: en móvil ofrece la mejor experiencia (rueda del sistema) y es
 * accesible por teclado sin trabajo adicional.
 */
export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(CONTROL_CLASSES, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
});

export function Checkbox({
  className,
  label,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex items-center gap-2">
      <input
        id={inputId}
        type="checkbox"
        className={cn(
          "size-4 rounded border-zinc-300 text-brand-600 accent-brand-600 dark:border-zinc-600",
          className,
        )}
        {...props}
      />
      <Label htmlFor={inputId} className="cursor-pointer select-none font-normal">
        {label}
      </Label>
    </div>
  );
}
