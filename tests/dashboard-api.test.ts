import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchHeatmapMetrics, fetchOverview } from "@/features/metrics/api/dashboard.api";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({}),
  } as unknown as Response);
});

afterEach(() => vi.unstubAllGlobals());

describe("endpoints de dashboard", () => {
  it("usa /api/dashboard sin el segmento proxy", async () => {
    await fetchOverview("30d", "America/Bogota");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/dashboard/overview?period=30d&tz=America%2FBogota");
  });

  it("mantiene las rutas anidadas del dashboard", async () => {
    await fetchHeatmapMetrics("7d");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/dashboard/messages/heatmap?period=7d");
  });
});
