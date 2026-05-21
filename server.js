const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

const PORT = 3456;
const DATA_FILE = path.join(__dirname, "leaderboard.json");

// Load persisted data
let data = { users: {} };
try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    data = JSON.parse(raw);
    console.log("Loaded", Object.keys(data.users).length, "users from disk");
} catch (e) {
    console.log("No existing data, starting fresh");
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Save error:", e.message);
    }
}

const wss = new WebSocket.Server({ port: PORT });
console.log("WebSocket server running on port", PORT);

// Clean up stale users (no update for > 1 hour)
setInterval(function() {
    const cutoff = Date.now() - 60 * 60 * 1000;
    let changed = false;
    Object.keys(data.users).forEach(function(id) {
        if ((data.users[id].lastSeen || 0) < cutoff) {
            delete data.users[id];
            changed = true;
        }
    });
    if (changed) {
        saveData();
        broadcast();
        console.log("Cleaned stale users, active:", Object.keys(data.users).length);
    }
}, 5 * 60 * 1000);

function broadcast() {
    const payload = JSON.stringify({ type: "leaderboard", users: data.users });
    wss.clients.forEach(function(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

wss.on("connection", function(ws, req) {
    const ip = req.socket.remoteAddress;
    console.log("Client connected:", ip);

    // Send current data immediately
    ws.send(JSON.stringify({ type: "leaderboard", users: data.users }));

    ws.on("message", function(raw) {
        try {
            const msg = JSON.parse(raw);

            if (msg.type === "drink" && msg.userId) {
                var user = data.users[msg.userId];
                if (!user) {
                    user = { name: msg.name || "匿名", totalMl: 0, count: 0, lastSeen: Date.now() };
                    data.users[msg.userId] = user;
                }
                user.name = msg.name || user.name;
                user.totalMl = msg.totalMl;
                user.count = msg.count;
                user.lastSeen = Date.now();

                saveData();
                broadcast();
                console.log(user.name, "drank, total:", user.totalMl);
            }

            if (msg.type === "join" && msg.userId) {
                var user = data.users[msg.userId];
                if (!user) {
                    user = { name: msg.name || "匿名", totalMl: msg.totalMl || 0, count: msg.count || 0, lastSeen: Date.now() };
                    data.users[msg.userId] = user;
                } else {
                    user.name = msg.name || user.name;
                    user.totalMl = Math.max(user.totalMl, msg.totalMl || 0);
                    user.count = Math.max(user.count, msg.count || 0);
                    user.lastSeen = Date.now();
                }
                saveData();
                broadcast();
                console.log(user.name, "joined");
            }

            if (msg.type === "ping") {
                ws.send(JSON.stringify({ type: "pong" }));
            }
        } catch (e) {
            console.error("Message error:", e.message);
        }
    });

    ws.on("close", function() {
        console.log("Client disconnected:", ip);
    });

    ws.on("error", function() {
        // ignore
    });
});
