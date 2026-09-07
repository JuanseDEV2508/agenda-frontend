import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomeView } from "@/components/home/home-view";
import { SessionProvider } from "@/features/auth/hooks/use-session";
import type { Session } from "@/features/auth/types";

import { ADMIN_PERMISSIONS, makeSession, makeUser } from "./factories";

/**
 * El cableado del inicio: que cada bloque pida lo suyo, pinte lo que llega y
 * respete el alcance del rol. El reparto en cubos se prueba aparte, en
 * `home-select.test.ts`.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/** Hoy a media mañana en Bogotá, para que "ya pasó" y "aún no" sean estables. */
const NOW = new Date("2026-08-10T10:00:00-05:00");

const event = (overrides: Record<string, unknown>) => ({
  id: "event-1",
  title: "Visita apartamento",
  event_type: "PROPERTY_VISIT",
  status: "CONFIRMED",
  start_at: "2026-08-10T15:00:00-05:00",
  end_at: "2026-08-10T16:00:00-05:00",
  timezone: "America/Bogota",
  advisor: "advisor-1",
  advisor_name: "Carlos Pérez",
  client: "client-1",
  client_name: "Laura Gómez",
  ...overrides,
});

const overview = {
  period: {},
  comparison_period: {},
  agenda: {
    date_field: "start_at",
    total: 12,
    closed: 10,
    completed: 8,
    completion_rate_pct: 80,
    cancellation_rate_pct: 10,
    no_show_rate_pct: 10,
    from_chatbot: 3,
    chatbot_share_pct: 25,
    avg_duration_minutes: 60,
    by_status: {},
    trend: { total: { current: 12, previous: 10, change: 2, change_pct: 20 } },
  },
  inbox: null,
};

/** Responde según la URL, que es como se distinguen las cuatro consultas. */
function respondWith({ week = [], lastWeek = [] }: { week?: unknown[]; lastWeek?: unknown[] }) {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("calendar/week")) {
      const isPrevious = url.includes("2026-08-03");
      return Promise.resolve(jsonResponse({ events: isPrevious ? lastWeek : week }));
    }
    if (url.includes("dashboard/overview")) return Promise.resolve(jsonResponse(overview));
    if (url.includes("dashboard/advisors")) {
      return Promise.resolve(
        jsonResponse({
          advisors: [
            { advisor_id: "a1", code: "ASE-001", name: "Ana Torres", email: "", total: 5, pending: 0, confirmed: 0, completed: 4, cancelled: 0, no_show: 1, from_chatbot: 0, completion_rate_pct: 80, no_show_rate_pct: 20 },
          ],
        }),
      );
    }
    return Promise.resolve(jsonResponse({}));
  });
}

function renderHome(session: Session = makeSession()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={session}>
        <HomeView />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("HomeView", () => {
  it("saluda por el nombre y pinta los eventos de hoy", async () => {
    respondWith({ week: [event({ id: "hoy", title: "Visita apartamento Chapinero" })] });

    renderHome();

    expect(screen.getByText(/Hola/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Visita apartamento Chapinero")).toBeInTheDocument(),
    );
  });

  it("lleva a «Requieren tu atención» lo que ya pasó y sigue abierto", async () => {
    respondWith({
      lastWeek: [
        event({ id: "atrasado", title: "Visita sin cerrar", start_at: "2026-08-09T09:00:00-05:00", end_at: "2026-08-09T10:00:00-05:00" }),
      ],
    });

    renderHome();

    await waitFor(() => expect(screen.getByText(/Sin cerrar/)).toBeInTheDocument());
    expect(screen.getByText("Visita sin cerrar")).toBeInTheDocument();
  });

  it("muestra los indicadores propios del periodo", async () => {
    respondWith({});

    renderHome();

    await waitFor(() => expect(screen.getByText("80%")).toBeInTheDocument());
    expect(screen.getByText("Tasa de cumplimiento")).toBeInTheDocument();
  });

  it("explica los bloques vacíos en vez de dejarlos en blanco", async () => {
    respondWith({});

    renderHome();

    await waitFor(() => expect(screen.getByText("Nada agendado para hoy")).toBeInTheDocument());
    expect(screen.getByText("Todo al día")).toBeInTheDocument();
    expect(screen.getByText("La semana está despejada")).toBeInTheDocument();
  });

  it("no pide ni pinta el bloque de equipo para un asesor", async () => {
    respondWith({});

    renderHome();

    await waitFor(() => expect(screen.getByText("Nada agendado para hoy")).toBeInTheDocument());
    expect(screen.queryByText(/Rendimiento de la empresa|Mi equipo/)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("dashboard/advisors"))).toBe(true);
  });

  it("añade el bloque de empresa para administración", async () => {
    respondWith({});

    renderHome(makeSession({ user: makeUser({ role: "ADMIN", permissions: ADMIN_PERMISSIONS }) }));

    await waitFor(() => expect(screen.getByText("Rendimiento de la empresa")).toBeInTheDocument());
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
  });
});
