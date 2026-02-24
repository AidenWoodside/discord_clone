import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { hashPassword, generateAccessToken } from '../plugins/auth/authService.js';
import { users, invites } from '../db/schema.js';

export async function setupApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  runMigrations(app.db);
  return app;
}

export async function seedOwner(app: FastifyInstance): Promise<{ id: string; token: string }> {
  const passwordHash = await hashPassword('ownerPass123');
  const owner = app.db.insert(users).values({
    username: 'owner',
    password_hash: passwordHash,
    role: 'owner',
  }).returning().get();
  const token = generateAccessToken({ userId: owner.id, role: 'owner' });
  return { id: owner.id, token };
}

export async function seedRegularUser(app: FastifyInstance): Promise<{ id: string; token: string }> {
  const passwordHash = await hashPassword('userPass123');
  const user = app.db.insert(users).values({
    username: 'regular',
    password_hash: passwordHash,
    role: 'user',
  }).returning().get();
  const token = generateAccessToken({ userId: user.id, role: 'user' });
  return { id: user.id, token };
}

export function seedInvite(app: FastifyInstance, createdBy: string, tokenValue = 'valid-invite-token'): string {
  app.db.insert(invites).values({
    token: tokenValue,
    created_by: createdBy,
  }).run();
  return tokenValue;
}
