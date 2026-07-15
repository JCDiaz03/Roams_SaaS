import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Referencia 14.2: React escapa por defecto y aqui no hay HTML de terceros que pintar.
      // La regla existe para que un XSS no entre por descuido ni por sugerencia de la IA.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML esta prohibido (referencia 14.2).',
        },
        {
          selector: "Property[key.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML esta prohibido (referencia 14.2).',
        },
      ],
    },
  },
)
