"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/feedback";
import { safeNextPath } from "@/config/routes";
import { login } from "@/features/auth/api/auth.api";
import { loginSchema, type LoginInput, type LoginValues } from "@/features/auth/schemas";
import { isApiError } from "@/lib/api/errors";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);

    try {
      await login(values);

      // Nada del usuario anterior debe sobrevivir a un nuevo inicio de sesión.
      queryClient.clear();

      const target = safeNextPath(searchParams.get("next"));
      router.replace(target);
      router.refresh();
    } catch (error) {
      if (isApiError(error)) {
        // Errores por campo devueltos por el servidor.
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (field === "email" || field === "password") {
            setError(field, { type: "server", message: messages[0] });
          }
        }
        setFormError(error.message);
        return;
      }

      setFormError("No fue posible iniciar sesión. Inténtalo de nuevo.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {formError ? (
        <InlineAlert variant="error" title="No se pudo iniciar sesión">
          {formError}
        </InlineAlert>
      ) : null}

      <Field
        label="Correo electrónico"
        htmlFor="email"
        required
        error={errors.email?.message}
      >
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoFocus
          placeholder="nombre@inmobiliaria.co"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          disabled={isSubmitting}
          {...register("email")}
        />
      </Field>

      <Field label="Contraseña" htmlFor="password" required error={errors.password?.message}>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className="pr-11"
            aria-invalid={Boolean(errors.password)}
            disabled={isSubmitting}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            tabIndex={0}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </Field>

      <Checkbox
        id="rememberMe"
        label="Recordarme en este dispositivo"
        disabled={isSubmitting}
        {...register("rememberMe")}
      />

      <Button type="submit" size="lg" className="w-full justify-center" isLoading={isSubmitting}>
        {!isSubmitting ? <LogIn className="size-4" aria-hidden="true" /> : null}
        {isSubmitting ? "Iniciando sesión…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
