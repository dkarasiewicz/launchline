import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'scope:core',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'target:server',
                'target:isomorphic',
              ],
            },
            {
              sourceTag: 'type:common',
              onlyDependOnLibsWithTags: ['type:common'],
            },
            {
              sourceTag: 'type:domain',
              onlyDependOnLibsWithTags: ['type:common'],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:common',
                'type:domain',
                'type:feature',
              ],
            },
            {
              sourceTag: 'scope:customer-ui',
              onlyDependOnLibsWithTags: [
                'scope:customer-ui',
                'target:client',
                'target:isomorphic',
              ],
            },
            {
              sourceTag: 'target:client',
              onlyDependOnLibsWithTags: ['target:client', 'target:isomorphic'],
            },
            {
              sourceTag: 'target:server',
              onlyDependOnLibsWithTags: ['target:server', 'target:isomorphic'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
