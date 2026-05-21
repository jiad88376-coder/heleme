const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "3456");
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

// === HTTP server: serve static frontend files ===
const ROOT = __dirname;
const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
    if (req.url === "/health") { res.writeHead(200, { "Content-Type": "text/plain" }); return res.end("OK"); }
		// Default to index.html for root
    let filePath = req.url === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, req.url);
    // Security: prevent directory traversal
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        return res.end("Forbidden");
    }
    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
            return res.end("<h1>404 - Page Not Found</h1>");
        }
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(data);
    });
});

// === WebSocket server: attach to same HTTP server ===
const wss = new WebSocket.Server({ server });
console.log("Heleme server running on port", PORT);

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
                    user = { name: msg.name || "\u533F\u540D", totalMl: 0, count: 0, lastSeen: Date.now() };
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
                    user = { name: msg.name || "\u533F\u540D", totalMl: msg.totalMl || 0, count: msg.count || 0, lastSeen: Date.now() };
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

server.listen(PORT, "0.0.0.0", () => {
    console.log("HTTP + WebSocket server listening on port", PORT);
});
