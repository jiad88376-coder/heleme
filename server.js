const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "3456");
const DATA_FILE = path.join(__dirname, "leaderboard.json");

// Data structure for both apps
let data = { water: { currentDate: "", users: {} }, workout: { currentDate: "", users: {} } };
try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    var parsed = JSON.parse(raw);
    if (parsed.water && parsed.workout) {
        data = parsed;
    } else if (parsed.users) {
        // Legacy format migration
        data.water = { currentDate: parsed.currentDate || getToday(), users: parsed.users };
        data.workout = { currentDate: getToday(), users: {} };
    }
    console.log("Loaded water:", Object.keys(data.water.users).length, "workout:", Object.keys(data.workout.users).length);
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

function getToday() {
    var d = new Date();
    var offset = 8 * 60;
    var local = new Date(d.getTime() + offset * 60 * 1000);
    return local.toISOString().slice(0, 10);
}

function checkDailyReset(appName) {
    var today = getToday();
    var ds = data[appName] || data.water;
    if (ds.currentDate !== today) {
        console.log(appName + " reset: " + (ds.currentDate || "initial") + " -> " + today);
        ds.currentDate = today;
        Object.keys(ds.users).forEach(function(uid) {
            ds.users[uid].totalMl = 0;
            ds.users[uid].count = 0;
            ds.users[uid].lastSeen = Date.now();
        });
        saveData();
        var payload = JSON.stringify({ type: "dailyReset", app: appName, date: today });
        wss.clients.forEach(function(client) {
            if (client.readyState === WebSocket.OPEN) client.send(payload);
        });
        console.log(appName + " reset for new day:", today);
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
    var filePath = req.url === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, req.url);
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end("Forbidden"); }
    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (err, fileData) => {
        if (err) {
            res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
            return res.end("<h1>404 - Page Not Found</h1>");
        }
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(fileData);
    });
});

// === WebSocket server ===
const wss = new WebSocket.Server({ server });
console.log("Heleme server running on port", PORT);

function broadcast(appName) {
    var ds = data[appName] || data.water;
    const payload = JSON.stringify({ type: "leaderboard", app: appName || "water", users: ds.users, date: ds.currentDate });
    wss.clients.forEach(function(client) {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
}

// Clean stale users
setInterval(function() {
    const cutoff = Date.now() - 60 * 60 * 1000;
    ["water", "workout"].forEach(function(appName) {
        var ds = data[appName];
        if (!ds) return;
        var changed = false;
        Object.keys(ds.users).forEach(function(id) {
            if ((ds.users[id].lastSeen || 0) < cutoff) {
                delete ds.users[id];
                changed = true;
            }
        });
        if (changed) { saveData(); broadcast(appName); }
    });
}, 5 * 60 * 1000);

wss.on("connection", function(ws) {
    ["water", "workout"].forEach(function(a) { checkDailyReset(a); });
    ws.send(JSON.stringify({ type: "leaderboard", app: "water", users: data.water.users, date: data.water.currentDate }));
    ws.send(JSON.stringify({ type: "leaderboard", app: "workout", users: data.workout.users, date: data.workout.currentDate }));

    ws.on("message", function(raw) {
        try {
            const msg = JSON.parse(raw);

            // === Water app: drink ===
            if (msg.type === "drink" && msg.userId) {
                checkDailyReset("water");
                var u = data.water.users[msg.userId];
                if (!u) { u = { name: msg.name || "匿名", totalMl: 0, count: 0, lastSeen: Date.now() }; data.water.users[msg.userId] = u; }
                u.name = msg.name || u.name; u.totalMl = msg.totalMl; u.count = msg.count; u.lastSeen = Date.now();
                saveData(); broadcast("water");
                console.log(u.name, "drank, total:", u.totalMl);
            }

            // === Workout app: log session ===
            if (msg.type === "workout" && msg.userId) {
                checkDailyReset("workout");
                var u = data.workout.users[msg.userId];
                if (!u) { u = { name: msg.name || "锻炼达人", totalMl: 0, count: 0, lastSeen: Date.now() }; data.workout.users[msg.userId] = u; }
                u.name = msg.name || u.name; u.totalMl = msg.totalMin || 0; u.count = msg.sessions || 0; u.lastSeen = Date.now();
                saveData(); broadcast("workout");
                console.log(u.name, "worked out, min:", u.totalMl);
            }

            // === Join handler ===
            if (msg.type === "join" && msg.userId) {
                var appName = msg.app || "water";
                var ds = data[appName] || data.water;
                checkDailyReset(appName);
                // Duplicate name check
                var nameLower = (msg.name || "").toLowerCase().trim();
                if (nameLower) {
                    var taken = false;
                    Object.keys(ds.users).forEach(function(uid) {
                        if (uid !== msg.userId && ds.users[uid].name && ds.users[uid].name.toLowerCase().trim() === nameLower) taken = true;
                    });
                    if (taken) { ws.send(JSON.stringify({ type: "nameTaken", name: msg.name })); return; }
                }
                var u = ds.users[msg.userId];
                if (!u) {
                    u = { name: msg.name || "匿名", totalMl: msg.totalMl || 0, count: msg.count || 0, lastSeen: Date.now() };
                    ds.users[msg.userId] = u;
                } else {
                    u.name = msg.name || u.name; u.totalMl = Math.max(u.totalMl, msg.totalMl || 0);
                    u.count = Math.max(u.count, msg.count || 0); u.lastSeen = Date.now();
                }
                saveData(); broadcast(appName);
                console.log(u.name, "joined", appName);
            }

            // === Check name ===
            if (msg.type === "checkName" && msg.name && msg.userId) {
                var appName = msg.app || "water";
                var ds = data[appName] || data.water;
                var taken = false;
                var n = msg.name.toLowerCase().trim();
                if (n) {
                    Object.keys(ds.users).forEach(function(uid) {
                        if (uid !== msg.userId && ds.users[uid].name && ds.users[uid].name.toLowerCase().trim() === n) taken = true;
                    });
                }
                ws.send(JSON.stringify({ type: "checkNameResult", name: msg.name, available: !taken }));
            }

            // === Manual reset ===
if (msg.type === "resetDaily") {
                var a = msg.app || "water";
                var ds = data[a] || data.water;
                ds.currentDate = "";
                checkDailyReset(a);
                console.log("Manual reset for", a);
            }

            if (msg.type === "ping") {
                ws.send(JSON.stringify({ type: "pong" }));
            }
        } catch (e) {
            console.error("Message error:", e.message);
        }
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log("HTTP + WebSocket server listening on port", PORT);
});
