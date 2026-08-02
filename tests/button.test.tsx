import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

/**
 * Regresión: con `asChild`, Radix `Slot` exige EXACTAMENTE un hijo. Añadir un
 * hermano condicional (aunque sea `null`) provoca
 * "Slot failed to slot onto its children".
 */
describe("Button con asChild", () => {
  it("fusiona sus estilos sobre el hijo sin lanzar errores", () => {
    render(
      <Button asChild variant="outline">
        <a href="/agenda/eventos/event-1">
          Ver detalle completo
          <span aria-hidden="true">→</span>
        </a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: /ver detalle completo/i });
    expect(link).toHaveAttribute("href", "/agenda/eventos/event-1");
    expect(link.className).toContain("inline-flex");
  });

  it("no renderiza un botón anidado", () => {
    render(
      <Button asChild>
        <a href="/perfil">Mi perfil</a>
      </Button>,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("no añade el indicador de carga como hijo adicional", () => {
    const { container } = render(
      <Button asChild isLoading>
        <a href="/agenda">Agenda</a>
      </Button>,
    );

    expect(container.querySelector("a")?.children).toHaveLength(0);
  });
});

describe("Button estándar", () => {
  it("se bloquea mientras carga para evitar envíos dobles", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button isLoading onClick={onClick}>
        Guardar
      </Button>,
    );

    const button = screen.getByRole("button", { name: /guardar/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("es de tipo button por defecto para no enviar formularios sin querer", () => {
    render(<Button>Acción</Button>);
    expect(screen.getByRole("button", { name: /acción/i })).toHaveAttribute("type", "button");
  });
});
