import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";

export default [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "scripts/**", "supabase/**", "public/**"],
  },
  {
    plugins: { "unused-imports": unusedImports },
    rules: {
      // Auto-removes an import nothing uses; the base rule only reports it.
      "unused-imports/no-unused-imports": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      // Uploaded files are shown from signed Supabase URLs; next/image adds nothing there.
      "@next/next/no-img-element": "off",
      // The only <a> elements pointing at our own paths are CSV downloads under
      // /api/…/export, which must be a real navigation, not a <Link>.
      "@next/next/no-html-link-for-pages": "off",
      // Unused function arguments and caught errors are common when a handler
      // has a fixed signature; underscore-prefix the ones that are deliberate.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
];
