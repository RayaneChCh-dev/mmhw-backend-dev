import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { languages } from './schema';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

const languagesList = [
  { name: 'English', icon: '🇬🇧' },
  { name: 'Spanish', icon: '🇪🇸' },
  { name: 'French', icon: '🇫🇷' },
  { name: 'German', icon: '🇩🇪' },
  { name: 'Italian', icon: '🇮🇹' },
  { name: 'Portuguese', icon: '🇵🇹' },
  { name: 'Chinese', icon: '🇨🇳' },
  { name: 'Japanese', icon: '🇯🇵' },
  { name: 'Korean', icon: '🇰🇷' },
  { name: 'Arabic', icon: '🇸🇦' },
  { name: 'Russian', icon: '🇷🇺' },
  { name: 'Hindi', icon: '🇮🇳' },
  { name: 'Dutch', icon: '🇳🇱' },
  { name: 'Swedish', icon: '🇸🇪' },
  { name: 'Norwegian', icon: '🇳🇴' },
  { name: 'Danish', icon: '🇩🇰' },
  { name: 'Finnish', icon: '🇫🇮' },
  { name: 'Polish', icon: '🇵🇱' },
  { name: 'Turkish', icon: '🇹🇷' },
  { name: 'Greek', icon: '🇬🇷' },
  { name: 'Hebrew', icon: '🇮🇱' },
  { name: 'Thai', icon: '🇹🇭' },
  { name: 'Vietnamese', icon: '🇻🇳' },
  { name: 'Indonesian', icon: '🇮🇩' },
  { name: 'Czech', icon: '🇨🇿' },
  { name: 'Romanian', icon: '🇷🇴' },
  { name: 'Hungarian', icon: '🇭🇺' },
  { name: 'Ukrainian', icon: '🇺🇦' },
];

async function seedLanguages() {
  console.log('🌍 Seeding languages...');

  try {
    // Insert all languages
    await db.insert(languages).values(languagesList).onConflictDoNothing();

    console.log(`✅ Successfully seeded ${languagesList.length} languages`);
  } catch (error) {
    console.error('❌ Error seeding languages:', error);
    throw error;
  } finally {
    await client.end();
  }
}

seedLanguages();
