/** Wraps an async route handler so thrown errors reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });
