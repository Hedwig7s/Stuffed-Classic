import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import stylisticJs from "@stylistic/eslint-plugin-js";
import eslintConfigPrettier from "eslint-config-prettier";
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
            "@stylistic/js": stylisticJs,
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/naming-convention": [
                "warn",
                {
                    selector: "enumMember",
                    format: ["PascalCase", "camelCase"],
                },
                {
                    format: ["camelCase"],
                    leadingUnderscore: "allow",
                    selector: "default",
                    trailingUnderscore: "allow",
                },

                {
                    format: ["camelCase", "PascalCase"],
                    selector: "import",
                },

                {
                    format: ["camelCase", "UPPER_CASE"],
                    leadingUnderscore: "allow",
                    selector: "variable",
                    trailingUnderscore: "allow",
                },

                {
                    format: ["PascalCase"],
                    selector: "typeLike",
                },
            ],
            "@typescript-eslint/no-unused-vars": "warn",
            "@stylistic/js/semi": ["warn", "always"],
        },
    },

    eslintConfigPrettier,
];
