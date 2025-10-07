// mitm/mitm-ws.js (ESM) — enhanced: flip controls + set scores + robust CLI
import fs from 'fs';
import WebSocket, { WebSocketServer } from 'ws';
import minimist from 'minimist';

const argv = minimist(process.argv.slice(2));
const LISTEN_PORT = argv.listen || 8080;
const TARGET = argv.target || 'ws://localhost:9000';
const LOGFILE = argv.logfile || 'mitm_log.jsonl';

let options = {
    mutate: false,
    dropRate: 0.0,
    teleportRate: 0.0,
    // new options:
    flipA: false,      // flip controls for player A (swap up/down)
    flipB: false,      // flip controls for player B
    forcedScores: null // { A: number|null, B: number|null } or null
};

function logLine(obj) {
    try { fs.appendFileSync(LOGFILE, JSON.stringify(obj) + '\n'); }
    catch (e) { console.error('log write failed', e); }
}

const wss = new WebSocketServer({ port: LISTEN_PORT }, () =>
    console.log(`MITM listening on ws://0.0.0.0:${LISTEN_PORT} -> ${TARGET}`));

// Helper to safely parse JSON
function tryParse(raw) {
    try { return JSON.parse(raw); } catch { return null; }
}

wss.on('connection', client => {
    // connect to actual backend (include path in TARGET if needed, e.g. ws://localhost:5001/ws)
    const upstream = new WebSocket(TARGET);

    upstream.on('open', () => console.log('Upstream connected to', TARGET));
    upstream.on('close', () => client.close());
    upstream.on('error', (e) => {
        console.error('Upstream error', e);
        try { client.close(); } catch {}
    });

    // client -> server (operator intent)
    client.on('message', raw => {
        const now = Date.now();
        logLine({ dir: 'c->s', ts: now, raw: raw.toString() });

        // chance to drop client->server messages
        if (Math.random() < options.dropRate) {
            console.log('Dropping client->server message.');
            return;
        }

        const obj = tryParse(raw);
        if (!obj) {
            // not JSON — just forward raw
            upstream.send(raw);
            return;
        }

        // If mutate mode and flip flags active, flip up/down for player A/B
        if (options.mutate) {
            if (obj.type === 'paddle_move') {
                if ((obj.player === 'A' && options.flipA) || (obj.player === 'both' && options.flipA)) {
                    // handle both single and combined shapes (flat and nested)
                    // flat: player:'A' up/down
                    if ('up' in obj || 'down' in obj) {
                        const up = !!obj.up, down = !!obj.down;
                        obj.up = down;
                        obj.down = up;
                        console.log('MITM: flipped A controls (flat).');
                    }
                    // nested: players: { A:{ up,down }, ... }
                    if (obj.players && obj.players.A) {
                        const up = !!obj.players.A.up, down = !!obj.players.A.down;
                        obj.players.A.up = down;
                        obj.players.A.down = up;
                        console.log('MITM: flipped A controls (nested).');
                    }
                }
                if ((obj.player === 'B' && options.flipB) || (obj.player === 'both' && options.flipB)) {
                    if ('up' in obj || 'down' in obj) {
                        const up = !!obj.up, down = !!obj.down;
                        obj.up = down;
                        obj.down = up;
                        console.log('MITM: flipped B controls (flat).');
                    }
                    if (obj.players && obj.players.B) {
                        const up = !!obj.players.B.up, down = !!obj.players.B.down;
                        obj.players.B.up = down;
                        obj.players.B.down = up;
                        console.log('MITM: flipped B controls (nested).');
                    }
                }
            }
        }

        upstream.send(JSON.stringify(obj));
    });

    // server -> client (authoritative state)
    upstream.on('message', raw => {
        const now = Date.now();
        logLine({ dir: 's->c', ts: now, raw: raw.toString() });

        let obj = tryParse(raw);
        if (!obj) {
            client.send(raw);
            return;
        }

        // teleport: randomly reposition the ball in server->client state messages
        if (options.mutate && obj.type === 'state' && Math.random() < options.teleportRate) {
            console.log('Teleporting ball (MITM mutation).');
            if (obj.ball) { obj.ball.x = Math.random() * 600; obj.ball.y = Math.random() * 300; }
        }

        // If forcedScores set, override the scores the server is sending
        if (obj.type === 'state' && options.forcedScores) {
            obj.scores = obj.scores || { A: 0, B: 0 };
            if (typeof options.forcedScores.A === 'number') obj.scores.A = options.forcedScores.A;
            if (typeof options.forcedScores.B === 'number') obj.scores.B = options.forcedScores.B;
            console.log('MITM: overriding scores ->', obj.scores);
        }

        client.send(JSON.stringify(obj));
    });

    client.on('close', () => upstream.close());
    client.on('error', (e) => console.error('Client error', e));
});

// Robust CLI handler
console.log('MITM CLI: commands: help, status, mutate on|off, droprate X, teleport X, flip A|B|both on|off, setscore A|B|both <n> [<m>], replay N, quit');
process.stdin.setEncoding('utf8');
process.stdin.on('data', (line) => {
    const raw = line; // raw includes newline etc
    const cmd = (line || '').trim();
    if (!cmd) return;

    const parts = cmd.split(/\s+/);
    const main = (parts[0] || '').toLowerCase();
    const arg1 = (parts[1] || '').toLowerCase();
    const arg2 = parts[2];

    if (main === 'help') {
        console.log('Commands:');
        console.log('  status');
        console.log('  mutate on|off');
        console.log('  droprate X        # decimal 0..1');
        console.log('  teleport X        # decimal 0..1');
        console.log('  flip A|B|both on|off   # flip up/down for A, B or both');
        console.log('  setscore A <n>    # set A score to n');
        console.log('  setscore B <n>    # set B score to n');
        console.log('  setscore both <a> <b>  # set both scores');
        console.log('  replay N');
        console.log('  quit');
        return;
    }

    if (main === 'status') {
        console.log('options:', options, 'logfile:', LOGFILE);
        return;
    }

    if (main === 'mutate') {
        options.mutate = (arg1 === 'on' || arg1 === '1' || arg1 === 'true');
        console.log('mutate =', options.mutate);
        return;
    }

    if (main === 'droprate') {
        options.dropRate = parseFloat(arg1) || 0;
        console.log('dropRate =', options.dropRate);
        return;
    }

    if (main === 'teleport') {
        options.teleportRate = parseFloat(arg1) || 0;
        console.log('teleportRate =', options.teleportRate);
        return;
    }

    if (main === 'flip') {
        const target = arg1.toUpperCase();
        const on = (arg2 === 'on' || arg2 === '1' || arg2 === 'true');
        if (target === 'A') { options.flipA = on; console.log('flipA =', options.flipA); return; }
        if (target === 'B') { options.flipB = on; console.log('flipB =', options.flipB); return; }
        if (target === 'BOTH' || target === 'ALL') { options.flipA = on; options.flipB = on; console.log('flipA,B =', on); return; }
        console.log('Usage: flip A|B|both on|off');
        return;
    }

    if (main === 'setscore') {
        if (arg1.toUpperCase() === 'A' && !isNaN(parseInt(arg2))) {
            options.forcedScores = options.forcedScores || { A: null, B: null };
            options.forcedScores.A = parseInt(arg2);
            console.log('forcedScores =', options.forcedScores);
            return;
        }
        if (arg1.toUpperCase() === 'B' && !isNaN(parseInt(arg2))) {
            options.forcedScores = options.forcedScores || { A: null, B: null };
            options.forcedScores.B = parseInt(arg2);
            console.log('forcedScores =', options.forcedScores);
            return;
        }
        if (arg1.toLowerCase() === 'both' && !isNaN(parseInt(arg2)) && !isNaN(parseInt(parts[3]))) {
            options.forcedScores = { A: parseInt(arg2), B: parseInt(parts[3]) };
            console.log('forcedScores =', options.forcedScores);
            return;
        }
        console.log('Usage: setscore A <n> | setscore B <n> | setscore both <a> <b>');
        return;
    }

    if (main === 'replay') {
        const n = parseInt(arg1) || 10;
        const lines = fs.existsSync(LOGFILE) ? fs.readFileSync(LOGFILE,'utf8').trim().split('\n') : [];
        const s2c = lines.map(l => tryParse(l)).filter(x => x && x.dir === 's->c').slice(-n);
        console.log('Last server->client messages:');
        s2c.forEach((e,i) => console.log(`#${i}`, e.raw));
        return;
    }

    if (main === 'quit' || main === 'exit') {
        console.log('Exiting MITM.');
        process.exit(0);
    }

    console.log('unknown cmd; type help');
});
