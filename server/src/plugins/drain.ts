import fp from 'fastify-plugin';
import { getClients } from '../ws/wsServer.js';

let draining = false;

export default fp(async function drainPlugin(fastify) {
  // POST /api/drain — trigger drain mode, signal WS clients to reconnect
  // GET /api/drain — poll remaining connection count
  fastify.route({
    method: ['GET', 'POST'],
    url: '/api/drain',
    config: { skipAuth: true },
    handler: async (request, reply) => {
      const token = request.headers['x-drain-token'];
      if (!token || token !== process.env.JWT_ACCESS_SECRET) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Invalid drain token' },
        });
      }

      const clients = getClients();

      if (request.method === 'POST' && !draining) {
        draining = true;
        fastify.log.info('Drain mode activated — signaling WebSocket clients to reconnect');

        // Send reconnect signal to all connected WebSocket clients
        const reconnectMessage = JSON.stringify({ type: 'reconnect' });
        for (const ws of clients.values()) {
          if (ws.readyState === ws.OPEN) {
            try {
              ws.send(reconnectMessage);
            } catch {
              // Client already disconnecting
            }
          }
        }
      }

      return { connections: clients.size };
    },
  });

  // Block new WebSocket upgrades when draining
  fastify.addHook('onRequest', async (request, reply) => {
    if (draining && request.url === '/ws') {
      return reply.status(503).send({
        error: { code: 'DRAINING', message: 'Server is draining' },
      });
    }
  });
});
