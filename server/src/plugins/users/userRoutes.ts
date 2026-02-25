import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { getAllUsers } from './userService.js';

export default fp(async (fastify: FastifyInstance) => {
  fastify.get('/', {
    schema: {
      response: {
        200: {
          type: 'object',
          required: ['data', 'count'],
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'username', 'role', 'createdAt'],
                properties: {
                  id: { type: 'string' },
                  username: { type: 'string' },
                  role: { type: 'string', enum: ['owner', 'user'] },
                  createdAt: { type: 'string' },
                },
                additionalProperties: false,
              },
            },
            count: { type: 'number' },
          },
          additionalProperties: false,
        },
      },
    },
  }, async (_request, reply) => {
    const allUsers = await getAllUsers(fastify.db);

    return reply.status(200).send({
      data: allUsers,
      count: allUsers.length,
    });
  });
}, { name: 'user-routes' });
