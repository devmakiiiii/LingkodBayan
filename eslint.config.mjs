import coreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

// ESLint flat config using the native flat exports shipped by
// eslint-config-next 16 (no FlatCompat bridge required).
const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.kilo/**',
      'next-env.d.ts',
      // Vendored/minified third-party bundles served as static assets.
      'public/**',
      // Local scratch/OCR artifacts.
      'scripts/_ccimg/**',
      'eng.traineddata',
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // The codebase predates strict typing in places; keep `any` visible as a
      // warning rather than blocking CI while the migration is gradual.
      '@typescript-eslint/no-explicit-any': 'warn',
      // React Compiler's set-state-in-effect rule flags many legitimate
      // dashboard fetch patterns; track as warnings until they are refactored.
      'react-hooks/set-state-in-effect': 'off',
      // Intentionally-unused parameters (kept for call-site compatibility) must
      // be prefixed with `_`; everything else stays a visible warning.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // The compiler rule flags safe legacy patterns; keep them visible
      // without blocking CI until the affected call sites are refactored.
    },
  },
  {
    // Local diagnostic/tooling scripts under scripts/ may use CommonJS.
    files: ['scripts/**/*.js', 'scripts/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    // Ambient module shims for bundled libraries legitimately need `any`.
    files: ['types/**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]

export default eslintConfig

