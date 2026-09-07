import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // `no-html-link-for-pages` existe para evitar recargas completas de página
    // en el código de la aplicación. En los tests un `<a>` es el sujeto de la
    // prueba, no navegación: `tests/button.test.tsx` comprueba justamente que
    // `<Button asChild>` se fusiona sobre un ancla suelta, y cambiarlo por
    // `<Link />` probaría otra cosa.
    files: ["tests/**"],
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
