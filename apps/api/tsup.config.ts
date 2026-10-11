import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts', 'src/db/migrate.ts', 'src/db/seed.ts', 'src/db/reset.ts'],
  format: 'esm',
  target: 'node22',
  clean: true,
  // The shared contracts package ships TypeScript source, so it is bundled into the output.
  noExternal: ['@cr/contracts'],
});
