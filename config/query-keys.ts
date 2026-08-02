import type { AgendaFilters, CalendarMonthKey } from "@/features/agenda/types";

/**
 * Claves de caché estables para TanStack Query.
 * Todas cuelgan de una raíz para poder invalidarlas por grupos.
 */
export const queryKeys = {
  session: ["session"] as const,
  company: ["company", "current"] as const,

  calendar: {
    all: ["calendar"] as const,
    day: (date: string) => ["calendar", "day", date] as const,
    week: (startDate: string) => ["calendar", "week", startDate] as const,
    month: ({ year, month }: CalendarMonthKey) =>
      ["calendar", "month", year, month] as const,
  },

  events: {
    all: ["events"] as const,
    list: (filters: AgendaFilters) => ["events", "list", filters] as const,
    detail: (eventId: string) => ["events", "detail", eventId] as const,
    history: (eventId: string) => ["events", "history", eventId] as const,
  },

  advisors: {
    all: ["advisors"] as const,
    list: () => ["advisors", "list"] as const,
    detail: (advisorId: string) => ["advisors", "detail", advisorId] as const,
    availabilityStatus: (advisorId: string) =>
      ["advisors", "availability-status", advisorId] as const,
  },

  clients: {
    all: ["clients"] as const,
    search: (term: string) => ["clients", "search", term] as const,
    detail: (clientId: string) => ["clients", "detail", clientId] as const,
  },

  availability: {
    blocks: (advisorId: string) => ["availability", "blocks", advisorId] as const,
  },

  schedulingConfig: ["scheduling-configuration", "default"] as const,
} as const;
