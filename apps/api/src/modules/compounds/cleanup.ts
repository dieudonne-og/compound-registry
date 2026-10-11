import type { FastifyInstance } from 'fastify';

const HOUR = 60 * 60 * 1000;

/** Runs housekeeping jobs hourly; never blocks shutdown. */
export function startMaintenance(app: FastifyInstance, jobs: Array<() => Promise<unknown>>) {
  const run = async () => {
    for (const job of jobs) {
      try {
        await job();
      } catch (err) {
        app.log.error({ err }, 'maintenance job failed');
      }
    }
  };
  const timer = setInterval(run, HOUR);
  timer.unref();
  app.addHook('onClose', async () => clearInterval(timer));
  void run();
}
