import type { Client } from "@/features/agenda/types";
import { apiClient } from "@/lib/api/client";

import { extractResults, normalizeClient } from "./normalizers";

/**
 * `GET /clients/`
 *
 * ⚠️ El parámetro de búsqueda no está documentado. Se envía `search=`
 * (convención `SearchFilter` de DRF) y, además, se filtra en el cliente sobre la
 * página recibida: así el buscador funciona tanto si el backend soporta el
 * parámetro como si lo ignora. Ver docs/frontend-api-analysis.md §4.3.
 */
const PAGE_SIZE = 25;

function matchesTerm(client: Client, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (needle === "") return true;

  return [client.name, client.phone, client.email]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLowerCase().includes(needle));
}

export async function searchClients(
  term: string,
  signal?: AbortSignal,
): Promise<Client[]> {
  const data = await apiClient.get<unknown>("clients", {
    searchParams: {
      search: term.trim() || undefined,
      page_size: PAGE_SIZE,
    },
    signal,
  });

  const clients = extractResults(data)
    .map(normalizeClient)
    .filter((client): client is Client => client !== null);

  return clients.filter((client) => matchesTerm(client, term)).slice(0, PAGE_SIZE);
}

export async function fetchClient(
  clientId: string,
  signal?: AbortSignal,
): Promise<Client | null> {
  const data = await apiClient.get<unknown>(`clients/${clientId}`, { signal });
  return normalizeClient(data);
}

/** Payload documentado de `POST /clients/`. */
export interface CreateClientPayload {
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  source: string;
}

export async function createClient(payload: CreateClientPayload): Promise<Client> {
  const data = await apiClient.post<unknown>("clients", { body: payload });
  const client = normalizeClient(data);

  if (!client) {
    throw new Error("La respuesta de POST /clients/ no tiene el formato esperado.");
  }

  return client;
}
