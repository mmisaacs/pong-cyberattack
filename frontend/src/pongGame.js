// frontend/src/pongGame.js
export default function startPong(player = 'both', onUpdate = () => {}) {
    // Attempt to use the canvas if present; otherwise run headless (dashboard-only)
    const canvas = document.getElementById('pongGame');
    const hasCanvas = !!canvas;
    let ctx = null;

    // Logical size (must match backend)
    const WIDTH = 650;
    const HEIGHT = 400;

    if (hasCanvas) {
        ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.style.width = WIDTH + 'px';
        canvas.style.height = HEIGHT + 'px';
        canvas.width = Math.floor(WIDTH * dpr);
        canvas.height = Math.floor(HEIGHT * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // --- Input handling (A = W/S, B = ArrowUp/ArrowDown) ---
    const intent = {
        A: { up: false, down: false },
        B: { up: false, down: false }
    };

    const keysOfInterest = new Set(['w', 's', 'ArrowUp', 'ArrowDown']);

    function setKey(isDown, key) {
        if (!keysOfInterest.has(key)) return;

        if (key === 'w') intent.A.up = isDown;
        if (key === 's') intent.A.down = isDown;
        if (key === 'ArrowUp') intent.B.up = isDown;
        if (key === 'ArrowDown') intent.B.down = isDown;

        sendInput(); // push changes
    }

    const onKeyDown = (e) => { if (!e.repeat) setKey(true, e.key); };
    const onKeyUp   = (e) => { setKey(false, e.key); };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // --- WebSocket connection (/ws proxied by Vite in dev) ---
    const wsUrl = (location.origin.replace(/^http/, 'ws')) + '/ws';
    let ws;
    let reconnectTimer = null;
    let lastSentAt = 0;
    // track last sent per paddle to avoid resending identical states
    let lastA = { up: false, down: false };
    let lastB = { up: false, down: false };

    function connect() {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            // Send initial neutral state for whichever side(s) this client controls
            sendInput(true);
        };

        ws.onclose = () => {
            if (!reconnectTimer) {
                reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, 800);
            }
        };

        ws.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data);
                if (msg.type === 'state') onServerState(msg);
                else if (msg.type === 'attack' || msg.type === 'alert') {
                    try { onUpdate({ type: 'event', event: msg }); } catch {}
                }
            } catch {}
        };
    }
    connect();

    // --- Render state from server ---
    const renderState = {
        seq: 0, ts: 0,
        ball: { x: WIDTH/2, y: HEIGHT/2, w: 10, h: 10 },
        paddles: { A: { y: HEIGHT/2 - 30, h: 60 }, B: { y: HEIGHT/2 - 30, h: 60 } },
        scores: { A: 0, B: 0 }
    };

    function onServerState(s) {
        if (typeof s.seq === 'number' && s.seq < renderState.seq) return; // ignore stale/replay
        renderState.seq = s.seq ?? renderState.seq + 1;
        renderState.ts  = s.ts  ?? Date.now();

        if (s.ball)       Object.assign(renderState.ball, s.ball);
        if (s.paddles?.A) Object.assign(renderState.paddles.A, s.paddles.A);
        if (s.paddles?.B) Object.assign(renderState.paddles.B, s.paddles.B);
        if (s.scores)     Object.assign(renderState.scores, s.scores);

        try { onUpdate({ type: 'state', state: JSON.parse(JSON.stringify(renderState)) }); } catch {}
    }

    // --- Send inputs (separate messages for A and B, throttled & deduped) ---
    function controlsAEnabled() { return player === 'A' || player === 'both' || player === 'Both'; }
    function controlsBEnabled() { return player === 'B' || player === 'both' || player === 'Both'; }

    function sendInput(force = false) {
        if (!ws || ws.readyState !== 1) return;
        const now = Date.now();
        if (!force && now - lastSentAt < 40) return; // cap ~25 msgs/sec total
        lastSentAt = now;

        if (controlsAEnabled() && (force || intent.A.up !== lastA.up || intent.A.down !== lastA.down)) {
            ws.send(JSON.stringify({ type: 'paddle_move', player: 'A', up: intent.A.up, down: intent.A.down }));
            lastA = { ...intent.A };
        }
        if (controlsBEnabled() && (force || intent.B.up !== lastB.up || intent.B.down !== lastB.down)) {
            ws.send(JSON.stringify({ type: 'paddle_move', player: 'B', up: intent.B.up, down: intent.B.down }));
            lastB = { ...intent.B };
        }
    }

    // --- Drawing ---
    function drawNet() {
        if (!ctx) return;
        ctx.fillStyle = '#555';
        const dashH = 10, gap = 8;
        for (let y = 0; y < HEIGHT; y += dashH + gap) {
            ctx.fillRect(WIDTH / 2 - 1, y, 2, dashH);
        }
    }
    function drawScores() {
        if (!ctx) return;
        ctx.fillStyle = '#fff';
        ctx.font = '24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(renderState.scores.A ?? 0), WIDTH / 2 - 40, 40);
        ctx.fillText(String(renderState.scores.B ?? 0), WIDTH / 2 + 40, 40);
    }
    function draw() {
        if (!ctx) return requestAnimationFrame(draw);
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        drawNet(); drawScores();

        // paddles (A left, B right)
        ctx.fillStyle = '#fff';
        ctx.fillRect(10,             renderState.paddles.A.y, 10, renderState.paddles.A.h);
        ctx.fillRect(WIDTH - 20,     renderState.paddles.B.y, 10, renderState.paddles.B.h);

        // ball
        ctx.fillStyle = '#20C20E';
        ctx.fillRect(renderState.ball.x, renderState.ball.y, renderState.ball.w, renderState.ball.h);

        // optional: push state to host each frame
        try { onUpdate({ type: 'state', state: JSON.parse(JSON.stringify(renderState)) }); } catch {}
        requestAnimationFrame(draw);
    }
    if (ctx) requestAnimationFrame(draw);

    // --- Cleanup ---
    return function cleanup() {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        try { ws && ws.close(); } catch {}
        if (reconnectTimer) clearTimeout(reconnectTimer);
    };
}