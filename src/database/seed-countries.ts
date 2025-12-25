import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { countries } from './schema';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

const countriesList = [
  { name: 'United States', icon: '🇺🇸' },
  { name: 'United Kingdom', icon: '🇬🇧' },
  { name: 'Canada', icon: '🇨🇦' },
  { name: 'Australia', icon: '🇦🇺' },
  { name: 'Germany', icon: '🇩🇪' },
  { name: 'France', icon: '🇫🇷' },
  { name: 'Spain', icon: '🇪🇸' },
  { name: 'Italy', icon: '🇮🇹' },
  { name: 'Portugal', icon: '🇵🇹' },
  { name: 'Netherlands', icon: '🇳🇱' },
  { name: 'Belgium', icon: '🇧🇪' },
  { name: 'Switzerland', icon: '🇨🇭' },
  { name: 'Austria', icon: '🇦🇹' },
  { name: 'Sweden', icon: '🇸🇪' },
  { name: 'Norway', icon: '🇳🇴' },
  { name: 'Denmark', icon: '🇩🇰' },
  { name: 'Finland', icon: '🇫🇮' },
  { name: 'Poland', icon: '🇵🇱' },
  { name: 'Czech Republic', icon: '🇨🇿' },
  { name: 'Greece', icon: '🇬🇷' },
  { name: 'Ireland', icon: '🇮🇪' },
  { name: 'Japan', icon: '🇯🇵' },
  { name: 'South Korea', icon: '🇰🇷' },
  { name: 'China', icon: '🇨🇳' },
  { name: 'Singapore', icon: '🇸🇬' },
  { name: 'Thailand', icon: '🇹🇭' },
  { name: 'Vietnam', icon: '🇻🇳' },
  { name: 'Indonesia', icon: '🇮🇩' },
  { name: 'Malaysia', icon: '🇲🇾' },
  { name: 'Philippines', icon: '🇵🇭' },
  { name: 'India', icon: '🇮🇳' },
  { name: 'Brazil', icon: '🇧🇷' },
  { name: 'Argentina', icon: '🇦🇷' },
  { name: 'Mexico', icon: '🇲🇽' },
  { name: 'Chile', icon: '🇨🇱' },
  { name: 'Colombia', icon: '🇨🇴' },
  { name: 'Peru', icon: '🇵🇪' },
  { name: 'South Africa', icon: '🇿🇦' },
  { name: 'Egypt', icon: '🇪🇬' },
  { name: 'Morocco', icon: '🇲🇦' },
  { name: 'Turkey', icon: '🇹🇷' },
  { name: 'Israel', icon: '🇮🇱' },
  { name: 'United Arab Emirates', icon: '🇦🇪' },
  { name: 'Saudi Arabia', icon: '🇸🇦' },
  { name: 'Russia', icon: '🇷🇺' },
  { name: 'Ukraine', icon: '🇺🇦' },
  { name: 'Romania', icon: '🇷🇴' },
  { name: 'Hungary', icon: '🇭🇺' },
  { name: 'Bulgaria', icon: '🇧🇬' },
  { name: 'Croatia', icon: '🇭🇷' },
  { name: 'Iceland', icon: '🇮🇸' },
  { name: 'Estonia', icon: '🇪🇪' },
  { name: 'Latvia', icon: '🇱🇻' },
  { name: 'Lithuania', icon: '🇱🇹' },
  { name: 'Slovenia', icon: '🇸🇮' },
  { name: 'Slovakia', icon: '🇸🇰' },
  { name: 'Luxembourg', icon: '🇱🇺' },
  { name: 'Malta', icon: '🇲🇹' },
  { name: 'Cyprus', icon: '🇨🇾' },
  { name: 'New Zealand', icon: '🇳🇿' },
];

async function seedCountries() {
  console.log('🌍 Seeding countries...');

  try {
    // Insert all countries
    await db.insert(countries).values(countriesList).onConflictDoNothing();

    console.log(`✅ Successfully seeded ${countriesList.length} countries`);
  } catch (error) {
    console.error('❌ Error seeding countries:', error);
    throw error;
  } finally {
    await client.end();
  }
}

seedCountries();
