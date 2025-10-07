// mitm/mitm-ws.js (ESM)
import fs from 'fs';
import WebSocket, { WebSocketServer } from 'ws';
import minimist from 'minimist';

const argv = minimist(process.argv.slice(2));
const LISTEN_PORT = argv.listen || 8080;
const TARGET = argv.target || 'ws://localhost:9000';
const LOGFILE = argv.logfile || 'mitm_log.jsonl';

let options = { mutate: false, dropRate: 0.0, teleportRate: 0.0 };

function logLine(obj) {
    try { fs.appendFileSync(LOGFILE, JSON.stringify(obj) + '\n'); }
    catch (e) { console.error('log write failed', e); }
}

const wss = new WebSocketServer({ port: LISTEN_PORT }, () =>
    console.log(`MITM listening on ws://0.0.0.0:${LISTEN_PORT} -> ${TARGET}`));

wss.on('connection', client => {
    // connect to actual backend
    const upstream = new WebSocket(TARGET);

    upstream.on('open', () => console.log('Upstream connected to', TARGET));
    upstream.on('close', () => client.close());
    upstream.on('error', (e) => console.error('Upstream error', e));

    client.on('message', raw => {
        const now = Date.now();
        logLine({ dir: 'c->s', ts: now, raw: raw.toString() });

        // chance to drop client->server messages
        if (Math.random() < options.dropRate) {
            console.log('Dropping client->server message.');
            return;
        }

        let obj;
        try { obj = JSON.parse(raw); } catch { upstream.send(raw); return; }

        // Example mutation: invert paddle controls for player A
        if (options.mutate && obj.type === 'paddle_move' && obj.player === 'A') {
            console.log('Mutating paddle_move for A (invert).');
            const up = !!obj.up, down = !!obj.down;
            obj.up = down;
            obj.down = up;
        }

        upstream.send(JSON.stringify(obj));
    });

    upstream.on('message', raw => {
        const now = Date.now();
        logLine({ dir: 's->c', ts: now, raw: raw.toString() });

        let obj;
        try { obj = JSON.parse(raw); } catch { client.send(raw); return; }

        // teleport: randomly reposition the ball in server->client state messages
        if (options.mutate && obj.type === 'state' && Math.random() < options.teleportRate) {
            console.log('Teleporting ball (MITM mutation).');
            if (obj.ball) { obj.ball.x = Math.random() * 600; obj.ball.y = Math.random() * 300; }
        }

        client.send(JSON.stringify(obj));
    });

    client.on('close', () => upstream.close());
    client.on('error', (e) => console.error('Client error', e));
});

// CLI controls via stdin
console.log('MITM CLI: commands: help, status, mutate on|off, droprate X, teleport X, replay N, quit');
process.stdin.setEncoding('utf8');
process.stdin.on('data', line => {
    const cmd = line.trim();
    if (cmd === 'help') {
        console.log('Commands: status, mutate on|off, droprate 0.2, teleport 0.1, replay 10, quit');
    } else if (cmd.startsWith('mutate ')) {
        options.mutate = cmd.split(/\s+/)[1] === 'on';
        console.log('mutate =', options.mutate);
    } else if (cmd.startsWith('droprate ')) {
        options.dropRate = parseFloat(cmd.split(/\s+/)[1]) || 0;
        console.log('dropRate =', options.dropRate);
    } else if (cmd.startsWith('teleport ')) {
        options.teleportRate = parseFloat(cmd.split(/\s+/)[1]) || 0;
        console.log('teleportRate =', options.teleportRate);
    } else if (cmd === 'status') {
        console.log('options:', options, 'logfile:', LOGFILE);
    } else if (cmd.startsWith('replay ')) {
        const n = parseInt(cmd.split(/\s+/)[1]) || 10;
        const lines = fs.existsSync(LOGFILE) ? fs.readFileSync(LOGFILE,'utf8').trim().split('\n') : [];
        const s2c = lines.map(l=>JSON.parse(l)).filter(x=>x.dir==='s->c').slice(-n);
        console.log('Last server->client messages:');
        s2c.forEach((e,i) => console.log(`#${i}`, e.raw));
    } else if (cmd === 'quit') {
        console.log('Exiting MITM.');
        process.exit(0);
    } else {
        console.log('unknown cmd; type help');
    }
});
