export default function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    const status = err.status || 500;
    if (status >= 500) {
        console.error(err);
    }

    res.status(status).json({
        success: false,
        message: status >= 500 ? "Internal Server Error." : err.message
    });
}
