import fp from 'fastify-plugin';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { users, invites, bans } from '../../db/schema.js';
import { hashPassword, verifyPassword, generateAccessToken, generateRefreshToken, hashToken, verifyRefreshToken } from './authService.js';
import { validateInvite } from '../invites/inviteService.js';
import { createSession, findSessionByTokenHash, deleteSession, cleanExpiredSessions } from './sessionService.js';
import { getAuthenticatedUser } from './authMiddleware.js';
import { encryptGroupKeyForUser, getGroupKey, initializeSodium, deserializePublicKey } from '../../services/encryptionService.js';
import { X25519_PUBLIC_KEY_BYTES } from 'discord-clone-shared';

interface RegisterBody {
  username: string;
  password: string;
  inviteToken: string;
  publicKey?: string;
}

interface LoginBody {
  username: string;
  password: string;
}

interface RefreshBody {
  refreshToken: string;
}

interface LogoutBody {
  refreshToken: string;
}

export default fp(async (fastify: FastifyInstance) => {
  // Clean up expired sessions on startup
  fastify.addHook('onReady', async () => {
    try {
      const deleted = cleanExpiredSessions(fastify.db);
      if (deleted > 0) {
        fastify.log.info(`Cleaned ${deleted} expired session(s)`);
      }
    } catch {
      // Sessions table may not exist yet (pre-migration)
    }
  });

  // Initialize sodium on startup for encryption operations
  fastify.addHook('onReady', async () => {
    await initializeSodium();
  });

  // POST /api/auth/register — PUBLIC
  fastify.post<{ Body: RegisterBody }>('/api/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password', 'inviteToken'],
        properties: {
          username: { type: 'string', minLength: 1, maxLength: 32 },
          password: { type: 'string', minLength: 8, maxLength: 72 },
          inviteToken: { type: 'string', minLength: 1 },
          publicKey: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const { username: rawUsername, password, inviteToken, publicKey } = request.body;
    const username = rawUsername.trim().toLowerCase();

    if (username.length === 0) {
      return reply.status(400).send({
        error: { code: 'INVALID_USERNAME', message: 'Username cannot be blank.' },
      });
    }

    // Validate publicKey length if provided
    let publicKeyBytes: Uint8Array | null = null;
    if (publicKey) {
      try {
        publicKeyBytes = deserializePublicKey(publicKey);
      } catch {
        return reply.status(400).send({
          error: { code: 'INVALID_PUBLIC_KEY', message: 'Public key must be a valid base64-encoded string.' },
        });
      }
      if (publicKeyBytes.length !== X25519_PUBLIC_KEY_BYTES) {
        return reply.status(400).send({
          error: { code: 'INVALID_PUBLIC_KEY', message: `Public key must be exactly ${X25519_PUBLIC_KEY_BYTES} bytes.` },
        });
      }
    }

    // 1. Validate invite token (using shared service — no duplicated logic)
    const inviteResult = validateInvite(fastify.db, inviteToken);
    if (!inviteResult.valid) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_INVITE',
          message: 'This invite is no longer valid. Ask the server owner for a new one.',
        },
      });
    }

    // 2. Hash password before entering transaction (async, yields event loop)
    const passwordHash = await hashPassword(password);

    // 3. Encrypt group key for user if publicKey was provided
    let encryptedGroupKey: string | null = null;
    if (publicKeyBytes) {
      const groupKey = getGroupKey();
      encryptedGroupKey = encryptGroupKeyForUser(groupKey, publicKeyBytes);
    }

    // 4. All DB mutations in a transaction for atomicity
    const result = fastify.db.transaction((tx) => {
      // 4a. Check bans (lightweight username-based check)
      const bannedUser = tx
        .select({ userId: bans.user_id })
        .from(bans)
        .innerJoin(users, eq(bans.user_id, users.id))
        .where(eq(users.username, username))
        .get();

      if (bannedUser) {
        return { error: 'REGISTRATION_BLOCKED' } as const;
      }

      // 4b. Check username uniqueness (fast-path before INSERT)
      const existingUser = tx
        .select()
        .from(users)
        .where(eq(users.username, username))
        .get();

      if (existingUser) {
        return { error: 'USERNAME_TAKEN' } as const;
      }

      // 4c. Insert user with publicKey and encryptedGroupKey
      try {
        const newUser = tx
          .insert(users)
          .values({
            username,
            password_hash: passwordHash,
            role: 'user',
            public_key: publicKey ?? null,
            encrypted_group_key: encryptedGroupKey,
          })
          .returning()
          .get();

        // 4d. Revoke invite token (single-use)
        tx.update(invites)
          .set({ revoked: true })
          .where(eq(invites.token, inviteToken))
          .run();

        return { error: null, user: newUser } as const;
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('UNIQUE constraint failed: users.username')) {
          return { error: 'USERNAME_TAKEN' } as const;
        }
        throw err;
      }
    });

    if (result.error === 'REGISTRATION_BLOCKED') {
      return reply.status(403).send({
        error: {
          code: 'REGISTRATION_BLOCKED',
          message: 'Registration is not available for this account.',
        },
      });
    }

    if (result.error === 'USERNAME_TAKEN') {
      return reply.status(409).send({
        error: {
          code: 'USERNAME_TAKEN',
          message: 'That username is taken. Try another.',
        },
      });
    }

    // Generate tokens for auto-login after registration
    const tokenPayload = { userId: result.user.id, role: result.user.role, username: result.user.username };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    createSession(fastify.db, result.user.id, refreshToken);

    return reply.status(201).send({
      data: {
        accessToken,
        refreshToken,
        user: {
          id: result.user.id,
          username: result.user.username,
          role: result.user.role,
        },
        encryptedGroupKey: result.user.encrypted_group_key ?? null,
      },
    });
  });

  // POST /api/auth/login — PUBLIC
  fastify.post<{ Body: LoginBody }>('/api/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const { username: rawUsername, password } = request.body;
    const username = rawUsername.trim().toLowerCase();

    // 1. Look up user
    const user = fastify.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .get();

    if (!user) {
      return reply.status(401).send({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' },
      });
    }

    // 2. Check bans (before expensive bcrypt — timing attack prevention)
    const ban = fastify.db
      .select()
      .from(bans)
      .where(eq(bans.user_id, user.id))
      .get();

    if (ban) {
      return reply.status(403).send({
        error: { code: 'ACCOUNT_BANNED', message: 'This account has been banned.' },
      });
    }

    // 3. Verify password
    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return reply.status(401).send({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' },
      });
    }

    // 4. Generate tokens
    const tokenPayload = { userId: user.id, role: user.role, username: user.username };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // 5. Create session in DB (hash refresh token before storing)
    createSession(fastify.db, user.id, refreshToken);

    return reply.status(200).send({
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        encryptedGroupKey: user.encrypted_group_key ?? null,
      },
    });
  });
  // POST /api/auth/refresh — PUBLIC (requires valid refresh token in body)
  fastify.post<{ Body: RefreshBody }>('/api/auth/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const { refreshToken } = request.body;

    // 1. Verify the JWT signature + expiry
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return reply.status(401).send({
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token.' },
      });
    }

    // 2. Hash incoming token, find matching session in DB
    const tokenHash = hashToken(refreshToken);
    const session = findSessionByTokenHash(fastify.db, tokenHash);

    if (!session) {
      return reply.status(401).send({
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token.' },
      });
    }

    // 3. Verify session not expired
    if (session.expires_at < new Date()) {
      deleteSession(fastify.db, session.id);
      return reply.status(401).send({
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token.' },
      });
    }

    // 4. Token rotation: delete old session, create new session with new tokens
    deleteSession(fastify.db, session.id);

    const tokenPayload = { userId: payload.userId, role: payload.role, username: payload.username };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    createSession(fastify.db, payload.userId, newRefreshToken);

    return reply.status(200).send({
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  });

  // POST /api/auth/logout — AUTHENTICATED
  fastify.post<{ Body: LogoutBody }>('/api/auth/logout', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    getAuthenticatedUser(request);
    const { refreshToken } = request.body;

    // Hash the refresh token, find and delete the matching session
    const tokenHash = hashToken(refreshToken);
    const session = findSessionByTokenHash(fastify.db, tokenHash);

    if (session) {
      deleteSession(fastify.db, session.id);
    }

    // Return 204 regardless (idempotent — don't leak session existence)
    return reply.status(204).send();
  });
}, { name: 'auth-routes' });
