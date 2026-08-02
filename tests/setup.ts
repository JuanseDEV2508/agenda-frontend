import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * Zona horaria del entorno de pruebas distinta a la de la empresa: así se
 * detecta cualquier conversión que dependa de la hora del dispositivo.
 */
process.env.TZ = "Europe/Madrid";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
