// backend/server.js
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
const app = express();
app.use(express.json());

// --- REST (handy for health checks / demos) ---
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// In production, serve the built frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get(/.*/, (_req, res) =>
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'))
);


// Start HTTP server (with friendly error)
const server = app.listen(PORT, () => {
    console.log(`HTTP listening on http://localhost:${PORT}`);
});
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Set PORT or stop the other process.`);
        process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
});

/* =========================
   PONG "PLC" GAME BACKEND
   ========================= */

// Court must match your canvas size
const WIDTH = 650;
const HEIGHT = 400;

// Authoritative game state
const state = {
    ball: { x: WIDTH / 2, y: HEIGHT / 2, vx: 260, vy: 180, w: 10, h: 10 }, // px/sec
    paddles: {
        A: { x: 10, y: HEIGHT / 2 - 30, w: 10, h: 60, speed: 360 },          // px/sec
        B: { x: WIDTH - 20, y: HEIGHT / 2 - 30, w: 10, h: 60, speed: 340 }
    },
    scores: { A: 0, B: 0 },
    seq: 0 // increments each broadcast (anti-replay demo)
};

// Simple utility
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const aabb = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Broadcast helpers
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();

function send(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch {}
}
function broadcast(obj) {
    const msg = JSON.stringify(obj);
    for (const ws of clients) {
        if (ws.readyState === 1) ws.send(msg); // 1 === OPEN
    }
}

wss.on('connection', (ws) => {
    clients.add(ws);
    // Send an initial snapshot so HMI can render immediately
    send(ws, {
        type: 'state',
        seq: state.seq,
        ball: state.ball,
        paddles: { A: { y: state.paddles.A.y }, B: { y: state.paddles.B.y } },
        scores: state.scores,
        ts: Date.now()
    });

    ws.on('message', (data) => {
        // Expect JSON: {type:'paddle_move', player:'A'|'B', up:true|false, down:true|false}
        let msg;
        try { msg = JSON.parse(data); } catch { return; }

        if (msg.type === 'paddle_move') {
            const p = (msg.player === 'A' || msg.player === 'B') ? msg.player : null;
            if (!p) return;
            // We only record intent flags; actual movement happens in the tick using dt
            const paddle = state.paddles[p];
            paddle._up = !!msg.up;
            paddle._down = !!msg.down;
        }

        if (msg.type === 'reset') {
            resetBall(Math.random() < 0.5 ? 1 : -1);
            // Optional: zero scores if msg.full === true
            if (msg.full) state.scores = { A: 0, B: 0 };
        }
    });

    ws.on('close', () => clients.delete(ws));
});

// Physics & game loop (authoritative)
let last = Date.now();
const TICK_HZ = 60;
const TICK_MS = 1000 / TICK_HZ;

function resetBall(dir = 1) {
    state.ball.x = WIDTH / 2 - state.ball.w / 2;
    state.ball.y = HEIGHT / 2 - state.ball.h / 2;
    // randomize vertical speed a bit; keep horizontal speed sign = dir
    const speed = 300; // px/sec base
    state.ball.vx = dir * speed;
    state.ball.vy = (Math.random() * 2 - 1) * speed * 0.6;
}

function step(dt) {
    const { ball, paddles } = state;

    // Paddle movement from intent flags
    for (const key of ['A', 'B']) {
        const p = paddles[key];
        const dy =
            (p._down ? 1 : 0) * p.speed * dt -
            (p._up ? 1 : 0) * p.speed * dt;
        p.y = clamp(p.y + dy, 0, HEIGHT - p.h);
    }

    // Move ball
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Wall bounce (top/bottom)
    if (ball.y <= 0) { ball.y = 0; ball.vy *= -1; }
    if (ball.y + ball.h >= HEIGHT) { ball.y = HEIGHT - ball.h; ball.vy *= -1; }

    // Paddle collisions
    if (aabb(ball, paddles.A)) {
        ball.x = paddles.A.x + paddles.A.w;
        ball.vx = Math.abs(ball.vx) * 1.03; // small speed up
        // add angle based on impact point
        const impact = (ball.y + ball.h / 2) - (paddles.A.y + paddles.A.h / 2);
        ball.vy += impact * 6; // tweak deflection strength
    }
    if (aabb(ball, paddles.B)) {
        ball.x = paddles.B.x - ball.w;
        ball.vx = -Math.abs(ball.vx) * 1.03;
        const impact = (ball.y + ball.h / 2) - (paddles.B.y + paddles.B.h / 2);
        ball.vy += impact * 6;
    }

    // Scoring
    if (ball.x + ball.w < 0) {         // passed left edge → B scores
        state.scores.B += 1;
        resetBall(+1);
    } else if (ball.x > WIDTH) {       // passed right edge → A scores
        state.scores.A += 1;
        resetBall(-1);
    }
}

function tick() {
    const now = Date.now();
    const dt = Math.min(0.05, (now - last) / 1000); // clamp dt to avoid big jumps
    last = now;

    step(dt);

    // Broadcast at ~60Hz
    state.seq += 1;
    broadcast({
        type: 'state',
        seq: state.seq,
        ball: { x: state.ball.x, y: state.ball.y, w: state.ball.w, h: state.ball.h },
        paddles: { A: { y: state.paddles.A.y, h: state.paddles.A.h },
            B: { y: state.paddles.B.y, h: state.paddles.B.h } },
        scores: state.scores,
        ts: now
    });
}

resetBall(Math.random() < 0.5 ? 1 : -1);
setInterval(tick, TICK_MS);