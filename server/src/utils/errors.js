class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
const badRequest = (m, d) => new AppError(400, 'VALIDATION_ERROR', m, d);
const unauthorized = (m = 'Authentication required') => new AppError(401, 'UNAUTHENTICATED', m);
const forbidden = (m = 'You do not have permission to do that') => new AppError(403, 'FORBIDDEN', m);
const notFound = (m = 'Not found') => new AppError(404, 'NOT_FOUND', m);
const conflict = (code, m, d) => new AppError(409, code, m, d);
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, wrap };
