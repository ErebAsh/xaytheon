const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io;
const userSockets = new Map(); // userId -> Set of socket IDs
const watchlistRooms = new Map(); // watchlistId -> Set of userIds

function initializeSocket(server) {
    io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:8080",
            credentials: true,
        },
    });

    // Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error("Authentication error"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id;
            next();
        } catch (err) {
            next(new Error("Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        console.log(`✅ User ${socket.userId} connected: ${socket.id}`);

        // Track user socket
        if (!userSockets.has(socket.userId)) {
            userSockets.set(socket.userId, new Set());
        }
        userSockets.get(socket.userId).add(socket.id);

        // Join watchlist room
        socket.on("join_watchlist", (watchlistId) => {
            socket.join(`watchlist:${watchlistId}`);

            if (!watchlistRooms.has(watchlistId)) {
                watchlistRooms.set(watchlistId, new Set());
            }
            watchlistRooms.get(watchlistId).add(socket.userId);

            // Broadcast user joined
            socket.to(`watchlist:${watchlistId}`).emit("user_joined", {
                userId: socket.userId,
                watchlistId,
            });

            // Send current viewers
            const viewers = Array.from(watchlistRooms.get(watchlistId) || []);
            socket.emit("presence_update", { watchlistId, viewers });
        });

        // Leave watchlist room
        socket.on("leave_watchlist", (watchlistId) => {
            socket.leave(`watchlist:${watchlistId}`);

            if (watchlistRooms.has(watchlistId)) {
                watchlistRooms.get(watchlistId).delete(socket.userId);
            }

            socket.to(`watchlist:${watchlistId}`).emit("user_left", {
                userId: socket.userId,
                watchlistId,
            });
        });

        // Handle disconnect
        socket.on("disconnect", () => {
            console.log(`❌ User ${socket.userId} disconnected: ${socket.id}`);

            if (userSockets.has(socket.userId)) {
                userSockets.get(socket.userId).delete(socket.id);
                if (userSockets.get(socket.userId).size === 0) {
                    userSockets.delete(socket.userId);
                }
            }

            // Remove from all watchlist rooms
            watchlistRooms.forEach((viewers, watchlistId) => {
                if (viewers.has(socket.userId)) {
                    viewers.delete(socket.userId);
                    io.to(`watchlist:${watchlistId}`).emit("user_left", {
                        userId: socket.userId,
                        watchlistId,
                    });
                }
            });
        });
    });

    console.log("🔌 WebSocket server initialized");
    return io;
}

function getIO() {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }
    return io;
}

// Emit notification to specific user
function emitToUser(userId, event, data) {
    if (userSockets.has(userId)) {
        userSockets.get(userId).forEach((socketId) => {
            io.to(socketId).emit(event, data);
        });
    }
}

// Emit to all users in a watchlist
function emitToWatchlist(watchlistId, event, data) {
    io.to(`watchlist:${watchlistId}`).emit(event, data);
}

module.exports = {
    initializeSocket,
    getIO,
    emitToUser,
    emitToWatchlist,
};
