import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  claimConversation,
  fetchConversation,
  fetchConversations,
  releaseConversation,
  sendAdvisorMessage,
} from "@/features/inbox/api/inbox.api";
import { ApiError } from "@/lib/api/errors";

/**
 * Contrato de la capa de API del chat: rutas, parámetros y payloads exactos
 * documentados en `agenda-backend/docs/inbox_whatsapp.md`.
 */

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

const conversation = {
  id: "conv-1",
  display_id: 7,
  contact: { id: "contact-1", name: "Camila", phone_number: "+573005560", chatbot_enabled: false },
  advisor: { id: "advisor-1", full_name: "Ana Torres" },
  assignment: "me",
  status: "open",
  unread_count: 0,
  last_message_preview: "Hola",
  last_activity_at: "2026-08-30T15:00:00-05:00",
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, body: init.body ? JSON.parse(String(init.body)) : undefined };
}

describe("lista de conversaciones", () => {
  it("desenvuelve la clave `conversations` que devuelve el backend", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ conversations: [conversation] }));

    const result = await fetchConversations();

    expect(result).toEqual([conversation]);
    expect(lastCall().url).toBe("/api/proxy/inbox/conversations?filter=all");
  });

  it("devuelve una lista vacía si el backend no envía la clave", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await expect(fetchConversations()).resolves.toEqual([]);
  });

  it("propaga el filtro por asesor", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ conversations: [] }));

    await fetchConversations({ filter: "bot", advisor: "advisor-1" });

    expect(lastCall().url).toBe("/api/proxy/inbox/conversations?filter=bot&advisor=advisor-1");
  });
});

describe("detalle y envío", () => {
  it("pide la conversación por id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ conversation, contact: conversation.contact, messages: [] }));

    await fetchConversation("conv-1");

    expect(lastCall().url).toBe("/api/proxy/inbox/conversations/conv-1");
  });

  it("envía el mensaje con el payload exacto", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: {}, conversation, ycloud_ok: true }, 201));

    await sendAdvisorMessage("conv-1", "hola");

    const call = lastCall();
    expect(call.url).toBe("/api/proxy/inbox/conversations/conv-1/messages");
    expect(call.init.method).toBe("POST");
    expect(call.body).toEqual({ content: "hola" });
  });

  it("traduce el 403 del chatbot conservando el código de negocio", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: "CHATBOT_ENABLED", message: "El chatbot está encendido." } }, 403),
    );

    const error = await sendAdvisorMessage("conv-1", "hola").catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("CHATBOT_ENABLED");
    expect((error as ApiError).message).toBe("El chatbot está encendido.");
  });
});

describe("tomar y devolver", () => {
  it("toma la conversación sin destino explícito", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ conversation, contact: conversation.contact }));

    await claimConversation("conv-1");

    const call = lastCall();
    expect(call.url).toBe("/api/proxy/inbox/conversations/conv-1/claim");
    expect(call.body).toEqual({});
  });

  it("reasigna indicando el asesor destino", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ conversation, contact: conversation.contact }));

    await claimConversation("conv-1", "advisor-2");

    expect(lastCall().body).toEqual({ advisor_id: "advisor-2" });
  });

  it("devuelve la conversación al asistente", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ conversation, contact: conversation.contact }));

    await releaseConversation("conv-1");

    expect(lastCall().url).toBe("/api/proxy/inbox/conversations/conv-1/release");
  });
});
