const { ZodError } = require('zod');
const config = require('../config');

function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const r = schema.safeParse(req[source]);
    if (!r.success) return next(r.error);
    if (source === 'query') req.validQuery = r.data; else req[source] = r.data;
    next();
  };
}


function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    const fields = {};
    for (const i of err.issues) fields[i.path.join('.') || '_'] = i.message;
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields', fields } });
  }
  if (err.name === 'CastError') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  if (err.name === 'ValidationError') {
    const fields = {};
    for (const [k, v] of Object.entries(err.errors)) fields[k] = v.message;
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data', fields } });
  }
  if (err.status) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } });
  }
  if (config.env !== 'test') console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please retry.' } });
}
module.exports = { validate, errorHandler };
