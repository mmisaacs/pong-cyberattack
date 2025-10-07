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

// --- REST ---
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// --- Static (production only) ---
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// --- Start HTTP server first ---
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
const WIDTH = 650;
const HEIGHT = 400;

const state = {
    ball: { x: WIDTH/2, y: HEIGHT/2, vx: 260, vy: 180, w: 10, h: 10 },
    paddles: {
        A: { x: 10, y: HEIGHT/2 - 30, w: 10, h: 60, speed: 360, _up: false, _down: false },
        B: { x: WIDTH - 20, y: HEIGHT/2 - 30, w: 10, h: 60, speed: 340, _up: false, _down: false }
    },
    scores: { A: 0, B: 0 },
    seq: 0
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const aabb = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// --- WebSocket server (create AFTER server exists) ---
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();

function send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch {} }
function broadcast(obj) {
    const msg = JSON.stringify(obj);
    for (const ws of clients) if (ws.readyState === 1) ws.send(msg);
}

wss.on('connection', (ws) => {
    clients.add(ws);

    // initial snapshot
    send(ws, {
        type: 'state',
        seq: state.seq,
        ball: state.ball,
        paddles: { A: { y: state.paddles.A.y, h: state.paddles.A.h },
            B: { y: state.paddles.B.y, h: state.paddles.B.h } },
        scores: state.scores,
        ts: Date.now()
    });

    ws.on('message', (data) => {
        let msg;
        try { msg = JSON.parse(data); } catch { return; }

        if (msg.type === 'paddle_move') {
            // 1) Single-side messages: {player:'A'|'B', up, down}
            if (msg.player === 'A' || msg.player === 'B') {
                const p = state.paddles[msg.player];
                p._up = !!msg.up;
                p._down = !!msg.down;
                return;
            }
            // 2) Combined message from one tab: {player:'both', aUp, aDown, bUp, bDown}
            if (msg.player === 'both') {
                if ('aUp' in msg || 'aDown' in msg || 'bUp' in msg || 'bDown' in msg) {
                    state.paddles.A._up   = !!msg.aUp;
                    state.paddles.A._down = !!msg.aDown;
                    state.paddles.B._up   = !!msg.bUp;
                    state.paddles.B._down = !!msg.bDown;
                    return;
                }
                // or nested: {player:'both', players:{A:{up,down}, B:{up,down}}}
                if (msg.players) {
                    const A = msg.players.A || {};
                    const B = msg.players.B || {};
                    state.paddles.A._up   = !!A.up;
                    state.paddles.A._down = !!A.down;
                    state.paddles.B._up   = !!B.up;
                    state.paddles.B._down = !!B.down;
                    return;
                }
            }
            return;
        }

        if (msg.type === 'reset') {
            resetBall(Math.random() < 0.5 ? 1 : -1);
            if (msg.full) state.scores = { A: 0, B: 0 };
            return;
        }
    });

    ws.on('close', () => clients.delete(ws));
});

// --- Physics loop ---
let last = Date.now();
const TICK_HZ = 60;
const TICK_MS = 1000 / TICK_HZ;

function resetBall(dir = 1) {
    state.ball.x = WIDTH/2 - state.ball.w/2;
    state.ball.y = HEIGHT/2 - state.ball.h/2;
    const speed = 300;
    state.ball.vx = dir * speed;
    state.ball.vy = (Math.random() * 2 - 1) * speed * 0.6;
}

function step(dt) {
    const { ball, paddles } = state;

    // paddles from intent
    for (const k of ['A','B']) {
        const p = paddles[k];
        const dy = (p._down ? 1 : 0) * p.speed * dt - (p._up ? 1 : 0) * p.speed * dt;
        p.y = clamp(p.y + dy, 0, HEIGHT - p.h);
    }

    // ball
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // walls
    if (ball.y <= 0) { ball.y = 0; ball.vy *= -1; }
    if (ball.y + ball.h >= HEIGHT) { ball.y = HEIGHT - ball.h; ball.vy *= -1; }

    // paddles
    if (aabb(ball, paddles.A)) {
        ball.x = paddles.A.x + paddles.A.w;
        ball.vx = Math.abs(ball.vx) * 1.03;
        const impact = (ball.y + ball.h/2) - (paddles.A.y + paddles.A.h/2);
        ball.vy += impact * 6;
    }
    if (aabb(ball, paddles.B)) {
        ball.x = paddles.B.x - ball.w;
        ball.vx = -Math.abs(ball.vx) * 1.03;
        const impact = (ball.y + ball.h/2) - (paddles.B.y + paddles.B.h/2);
        ball.vy += impact * 6;
    }

    // scoring
    if (ball.x + ball.w < 0) { state.scores.B += 1; resetBall(+1); }
    else if (ball.x > WIDTH) { state.scores.A += 1; resetBall(-1); }
}

function tick() {
    const now = Date.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    step(dt);

    state.seq += 1;
    broadcast({
        type: 'state',
        seq: state.seq,
        ball: { x: state.ball.x, y: state.ball.y, w: state.ball.w, h: state.ball.h },
        paddles: {
            A: { y: state.paddles.A.y, h: state.paddles.A.h },
            B: { y: state.paddles.B.y, h: state.paddles.B.h }
        },
        scores: state.scores,
        ts: now
    });
}

resetBall(Math.random() < 0.5 ? 1 : -1);
setInterval(tick, TICK_MS);
