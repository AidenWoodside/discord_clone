import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { getAllChannels } from './channelService.js';

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
                required: ['id', 'name', 'type', 'createdAt'],
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['text', 'voice'] },
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
    const allChannels = await getAllChannels(fastify.db);

    return reply.status(200).send({
      data: allChannels,
      count: allChannels.length,
    });
  });
}, { name: 'channel-routes' });
