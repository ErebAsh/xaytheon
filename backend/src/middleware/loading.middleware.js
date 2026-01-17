const { startRequest, endRequest } = require("../utils/loadingTracker");

module.exports = function loadingMiddleware(req, res, next) {
  startRequest();

  res.on("finish", () => {
    endRequest();
  });

  next();
};

