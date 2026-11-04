import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4000,
  isProd: process.env.NODE_ENV === 'production',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // true when the React app is hosted on another site (GitHub Pages) than this API.
  crossSite: process.env.CROSS_SITE === 'true',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SECRET_KEY || '',
  jwtSecret: process.env.JWT_SECRET || '',
  timezone: 'Asia/Manila',
  mail: {
    user: process.env.GMAIL_USER || '',
    pass: process.env.GMAIL_APP_PASSWORD || '',
  },
};

export function assertConfig() {
  const missing = [];
  if (!config.supabaseUrl) missing.push('SUPABASE_URL');
  if (!config.supabaseKey) missing.push('SUPABASE_SECRET_KEY');
  if (!config.jwtSecret) missing.push('JWT_SECRET');
  if (config.jwtSecret && config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET is too short. Use at least 32 random characters.');
  }

  if (missing.length) {
    throw new Error(
      `Missing environment variables: ${missing.join(', ')}. Copy backend/.env.example to backend/.env and fill it in.`
    );
  }
}
