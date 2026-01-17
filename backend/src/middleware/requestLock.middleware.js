const requestMap = new Map();

module.exports = function requestLock(req, res, next) {
  const key = `${req.ip}:${req.originalUrl}`;

  if (requestMap.has(key)) {
    return res.status(429).json({
      success: false,
      message: "Request already in progress. Please wait."
    });
  }

  requestMap.set(key, true);

  res.on("finish", () => {
    requestMap.delete(key);
  });

  next();
};

