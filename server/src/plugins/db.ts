import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createDatabase, type AppDatabase } from '../db/connection.js';

export default fp(async (fastify: FastifyInstance) => {
  const { db, sqlite } = createDatabase();
  fastify.decorate('db', db);
  fastify.log.info('Database connection established');

  fastify.addHook('onClose', () => {
    sqlite.close();
  });
}, { name: 'db' });

// Type augmentation for FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    db: AppDatabase;
  }
}
