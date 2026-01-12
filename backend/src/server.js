const app = require("./app");
const http = require("http");
const { initializeSocket } = require("./socket/socket.server");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize WebSocket
initializeSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Auth server running on port ${PORT}`);
  console.log(`🔌 WebSocket server ready`);
});
