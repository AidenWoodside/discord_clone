import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '../db/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, '../../drizzle');

async function runMigrations(): Promise<void> {
  console.log('Running database migrations against Supabase...');
  // createDatabase() is synchronous — returns { db, close, migrate }
  const { migrate, close } = createDatabase();
  try {
    await migrate(migrationsFolder);
    console.log('Migrations completed successfully');
  } finally {
    await close();
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
