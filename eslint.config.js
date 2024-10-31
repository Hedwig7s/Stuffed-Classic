import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import stylisticJs from '@stylistic/eslint-plugin-js';
export default [
    {
        files: ["**/*.{js,mjs,cjs,ts}"],
    },
    { languageOptions: { globals: globals.browser } },
    eslint.configs.recommended,
    ...tseslint.configs.strict,
    ...tseslint.configs.stylistic,
    {
        plugins: {
            "@stylistic/js": stylisticJs
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/naming-convention": "warn",
            "@typescript-eslint/no-unused-vars": "warn",
            "@stylistic/js/semi": ["warn", "always"]
        }
    }
];