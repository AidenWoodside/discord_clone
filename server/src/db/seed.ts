import { eq } from 'drizzle-orm';
import sodium from 'libsodium-wrappers';
import { users, channels } from './schema.js';
import { hashPassword } from '../plugins/auth/authService.js';
import type { AppDatabase } from './connection.js';

export async function runSeed(db: AppDatabase, logger?: { info: (msg: string) => void; warn: (msg: string) => void }): Promise<void> {
  const log = logger ?? { info: () => {}, warn: () => {} };

  // Check if owner already exists
  const existingOwner = db.select().from(users).where(eq(users.role, 'owner')).get();
  if (existingOwner) {
    log.info('Seeding skipped — owner already exists');
    return;
  }

  const ownerUsername = process.env.OWNER_USERNAME;
  const ownerPassword = process.env.OWNER_PASSWORD;
  if (!ownerUsername || !ownerPassword) {
    log.warn('OWNER_USERNAME and OWNER_PASSWORD not set — skipping owner creation');
    return;
  }

  // Generate GROUP_ENCRYPTION_KEY if not already set
  if (!process.env.GROUP_ENCRYPTION_KEY) {
    await sodium.ready;
    const groupKey = sodium.crypto_secretbox_keygen();
    const groupKeyBase64 = sodium.to_base64(groupKey);
    process.env.GROUP_ENCRYPTION_KEY = groupKeyBase64;
    log.info('Generated new GROUP_ENCRYPTION_KEY — see stderr for value');
    process.stderr.write(`\n  GROUP_ENCRYPTION_KEY=${groupKeyBase64}\n`);
    process.stderr.write('  Save this to your .env file. It will not be shown again.\n\n');
  }

  const passwordHash = await hashPassword(ownerPassword);

  db.transaction((tx) => {
    // Owner created without publicKey — encryption is set up when owner registers a keypair via the client
    tx.insert(users).values({
      username: ownerUsername,
      password_hash: passwordHash,
      role: 'owner',
    }).run();

    tx.insert(channels).values([
      { name: 'general', type: 'text' },
      { name: 'Gaming', type: 'voice' },
    ]).run();
  });

  log.info('Owner account created');
  log.info('Default channels seeded');
}
