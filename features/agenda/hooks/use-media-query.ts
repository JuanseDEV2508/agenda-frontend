"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Consulta de media query sin efectos ni `setState` diferido.
 * En el servidor devuelve `false`, de modo que el HTML inicial es estable.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
