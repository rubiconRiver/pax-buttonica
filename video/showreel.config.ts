import { defineConfig } from 'showreel/shoot';
import { FakeApi } from '../e2e/api';

/** Pax Buttonica in front of the camera: the dev server, the stand-in for the site, and how it looks on film. */
export default defineConfig<FakeApi>({
  baseURL: 'http://localhost:5231',
  server: { command: 'npm run dev -- --port 5231 --strictPort', cwd: '..' },
  out: 'out',
  theme: {
    name: 'pax-buttonica',
    fonts: { display: 'Oxanium', body: 'Inter', google: ['Oxanium:wght@400;600;700;800', 'Inter:wght@400;500;600;700'] },
    colors: { bg: '#05070d', fg: '#e8ecf7', muted: '#8d97af', accent: '#f2b84b', line: '#2c3450', panel: '#10151f' },
    chamfer: 18,
  },
  // One stand-in for the site per take, shared by every surface: the phones read the game and post presses through it.
  shared: () => new FakeApi(),
  prepare: async (context, role, api) => {
    await api.install(context);
    if (role.kind === 'screen') {
      // The tour shows the two-beat strategy card (primary first), a setting rather than the default.
      await context.addInitScript(() => {
        try { if (!localStorage.getItem('pb.settings.v5')) localStorage.setItem('pb.settings.v5', JSON.stringify({ primaryStage: true })); } catch { /* blank page */ }
      });
    }
  },
});
