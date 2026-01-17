let activeRequests = 0;

function startRequest() {
  activeRequests++;
}

function endRequest() {
  activeRequests = Math.max(0, activeRequests - 1);
}

function isLoading() {
  return activeRequests > 0;
}

module.exports = {
  startRequest,
  endRequest,
  isLoading
};

