import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/auth/login-form";

const replaceMock = vi.fn();
const refreshMock = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock, push: vi.fn() }),
  useSearchParams: () => searchParams,
}));

const fetchMock = vi.fn();

function renderLogin() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LoginForm />
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  searchParams = new URLSearchParams();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  replaceMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("formulario de inicio de sesión", () => {
  it("valida los campos obligatorios antes de llamar al servidor", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(await screen.findByText(/ingresa tu correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByText(/ingresa tu contraseña/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza un correo con formato inválido", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/correo electrónico/i), "no-es-correo");
    await user.type(screen.getByLabelText(/^contraseña/i), "secreto123");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(await screen.findByText(/correo electrónico válido/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("inicia sesión y redirige a la agenda", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse({ user: {}, company: {} }));
    renderLogin();

    await user.type(screen.getByLabelText(/correo electrónico/i), "admin@inmobiliaria.co");
    await user.type(screen.getByLabelText(/^contraseña/i), "secreto123");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/agenda"));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/login");
    expect(init.method).toBe("POST");
  });

  it("vuelve a la ruta solicitada tras iniciar sesión", async () => {
    const user = userEvent.setup();
    searchParams = new URLSearchParams({ next: "/agenda/eventos/event-1" });
    fetchMock.mockResolvedValue(jsonResponse({ user: {}, company: {} }));
    renderLogin();

    await user.type(screen.getByLabelText(/correo electrónico/i), "admin@inmobiliaria.co");
    await user.type(screen.getByLabelText(/^contraseña/i), "secreto123");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("/agenda/eventos/event-1"),
    );
  });

  it("ignora un destino externo en el parámetro next", async () => {
    const user = userEvent.setup();
    searchParams = new URLSearchParams({ next: "https://sitio-externo.com" });
    fetchMock.mockResolvedValue(jsonResponse({ user: {}, company: {} }));
    renderLogin();

    await user.type(screen.getByLabelText(/correo electrónico/i), "admin@inmobiliaria.co");
    await user.type(screen.getByLabelText(/^contraseña/i), "secreto123");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/agenda"));
  });

  it("muestra el error de credenciales sin redirigir", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: "Correo o contraseña incorrectos." }, 401),
    );
    renderLogin();

    await user.type(screen.getByLabelText(/correo electrónico/i), "admin@inmobiliaria.co");
    await user.type(screen.getByLabelText(/^contraseña/i), "incorrecta");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(await screen.findByText(/correo o contraseña incorrectos/i)).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("permite mostrar y ocultar la contraseña", async () => {
    const user = userEvent.setup();
    renderLogin();

    const password = screen.getByLabelText(/^contraseña/i);
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /mostrar contraseña/i }));
    expect(password).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /ocultar contraseña/i }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("no envía el formulario dos veces", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(jsonResponse({ user: {}, company: {} })), 50),
        ),
    );
    renderLogin();

    await user.type(screen.getByLabelText(/correo electrónico/i), "admin@inmobiliaria.co");
    await user.type(screen.getByLabelText(/^contraseña/i), "secreto123");

    const submit = screen.getByRole("button", { name: /iniciar sesión/i });
    await user.click(submit);
    await user.click(submit);

    await waitFor(() => expect(replaceMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
