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

// --- REST example ---
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Example POST to move a paddle (for later):
app.post('/api/paddle', (req, res) => {
    // { player: 'A' | 'B', y: number }
    console.log('paddle via REST', req.body);
    res.json({ ok: true });
});

// Serve the built frontend (production)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// ⚠️ Express 5: use a valid wildcard instead of '*'
app.get('/:path(*)', (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Start HTTP server
const server = app.listen(PORT, () => {
    console.log(`HTTP listening on http://localhost:${PORT}`);
});

// --- WebSocket server (real-time) ---
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('WS client connected');
    ws.send(JSON.stringify({ type: 'hello', ts: Date.now() }));

    ws.on('message', (data) => {
        let msg;
        try { msg = JSON.parse(data); } catch { return; }
        // Broadcast to everyone
        for (const client of wss.clients) {
            if (client.readyState === 1) client.send(JSON.stringify(msg)); // 1 === OPEN
        }
    });

    ws.on('close', () => console.log('WS client disconnected'));
});