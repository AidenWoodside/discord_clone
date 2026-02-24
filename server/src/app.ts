import Fastify, { FastifyInstance } from 'fastify';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // --- Plugin Registration ---
  // Domain plugins will be registered here:
  // app.register(authPlugin);
  // app.register(channelRoutes);
  // app.register(messageRoutes);
  // app.register(voicePlugin);
  // app.register(adminRoutes);
  // app.register(inviteRoutes);
  // app.register(presencePlugin);

  app.get('/api/health', async () => {
    return { data: { status: 'ok' } };
  });

  return app;
}
