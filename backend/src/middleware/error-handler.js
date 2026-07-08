export function errorHandler(error, _request, response, _next) {
  const statusCode = error.statusCode || 500;

  response.status(statusCode).json({
    message: error.message || "Something went wrong.",
    details: error.details || null,
    processingTrace: error.processingTrace || error.details?.processingTrace || []
  });
}

