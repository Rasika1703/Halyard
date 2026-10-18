const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { requireAuth, csrfGuard } = require('./middleware/auth');
const { errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: config.clientOrigins, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', csrfGuard);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/teams', requireAuth, require('./routes/teams'));
app.use('/api/work-items', requireAuth, require('./routes/workItems'));
app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
app.use(errorHandler);

module.exports = app;
