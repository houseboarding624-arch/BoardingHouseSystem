import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config, assertConfig } from './config.js';

assertConfig();

const { default: authRoutes } = await import('./routes/auth.js');
const { default: boarderRoutes } = await import('./routes/boarder.js');
const { default: qrRoutes } = await import('./routes/qr.js');
const { default: scanRoutes } = await import('./routes/scan.js');
const { default: gcashQrRoutes } = await import('./routes/gcashQr.js');
const { default: receiptRoutes } = await import('./routes/receipts.js');
const { default: managementRoutes } = await import('./routes/management.js');
const { default: ownerRoutes } = await import('./routes/owner.js');
const { startScheduler } = await import('./services/scheduler.js');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// The GCash QR upload is an image sent as a data URL, so this one path gets a bigger limit.
app.use('/api/gcash-qr', express.json({ limit: '700kb' }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

if (!config.isProd || config.crossSite) {
  // Development: the Vite dev server proxies /api, but allow direct calls too.
  // Cross-site: the React app lives on another origin (GitHub Pages) and must be allowed explicitly.
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
}

if (config.crossSite) {
  // The login cookie is SameSite=None here, so refuse state-changing requests from any other website (CSRF).
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin && origin !== config.clientOrigin) {
      return res.status(403).json({ success: false, message: 'Request blocked.' });
    }
    return next();
  });
}

app.use('/api/auth', authRoutes);
app.use('/api/boarder', boarderRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/gcash-qr', gcashQrRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api', managementRoutes);

app.get('/api/health', (req, res) => res.json({ success: true }));
app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'Not found.' }));

// Serve the built React app (npm run build) from the same server in production.
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../../dist');

if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: 'Something went wrong. Check the server logs and your Supabase configuration.',
  });
});

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
  startScheduler();
});
