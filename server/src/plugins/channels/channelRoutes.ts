import type { FastifyInstance } from 'fastify';
import { WS_TYPES } from 'discord-clone-shared';
import { getAllChannels, createChannel, deleteChannel, ChannelNotFoundError } from './channelService.js';
import { broadcastToAll } from '../../ws/wsServer.js';

export default async function channelRoutes(fastify: FastifyInstance) {
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
                  type: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
            count: { type: 'number' },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const channelList = getAllChannels(fastify.db);
    return reply.send({ data: channelList, count: channelList.length });
  });

  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 50 },
          type: { type: 'string', enum: ['text', 'voice'] },
        },
      },
    },
  }, async (request, reply) => {
    if (request.user?.role !== 'owner') {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Only the server owner can perform this action' },
      });
    }

    const { name, type } = request.body as { name: string; type: 'text' | 'voice' };
    const channel = createChannel(fastify.db, name.toLowerCase().replace(/\s+/g, '-'), type);

    broadcastToAll({ type: WS_TYPES.CHANNEL_CREATED, payload: { channel } });
    return reply.status(201).send({ data: channel });
  });

  fastify.delete('/:channelId', {
    schema: {
      params: {
        type: 'object',
        required: ['channelId'],
        properties: {
          channelId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    if (request.user?.role !== 'owner') {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Only the server owner can perform this action' },
      });
    }

    const { channelId } = request.params as { channelId: string };
    try {
      deleteChannel(fastify.db, channelId);
    } catch (err) {
      if (err instanceof ChannelNotFoundError) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Channel not found' },
        });
      }
      throw err;
    }

    broadcastToAll({ type: WS_TYPES.CHANNEL_DELETED, payload: { channelId } });
    return reply.status(204).send();
  });
}
