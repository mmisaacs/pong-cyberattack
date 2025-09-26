// frontend/src/pongGame.js
export default function startPong(player = 'A') {
    const canvas = document.getElementById('pongGame');
    if (!canvas) return () => {};

    const ctx = canvas.getContext('2d');

    // Logical size (should match backend WIDTH/HEIGHT)
    const WIDTH = 650;
    const HEIGHT = 400;

    // HiDPI scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = WIDTH + 'px';
    canvas.style.height = HEIGHT + 'px';
    canvas.width = Math.floor(WIDTH * dpr);
    canvas.height = Math.floor(HEIGHT * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // --- Input handling (intent flags the backend will consume) ---
    const keys = new Set();
    const onKeyDown = (e) => {
        if (e.key === 'w' || e.key === 's') { keys.add(e.key); sendInput(); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { keys.add(e.key); sendInput(); }
    };
    const onKeyUp = (e) => {
        if (keys.has(e.key)) { keys.delete(e.key); sendInput(); }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // --- WebSocket connection to backend (/ws is proxied by Vite in dev) ---
    const wsUrl = (location.origin.replace(/^http/, 'ws')) + '/ws';
    let ws;
    let reconnectTimer = null;
    let lastSent = 0;

    function connect() {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
            // Send initial input (so server knows our idle state)
            sendInput(true);
        };
        ws.onclose = () => {
            // Try to reconnect with a small backoff
            if (!reconnectTimer) {
                reconnectTimer = setTimeout(() => {
                    reconnectTimer = null;
                    connect();
                }, 800);
            }
        };
        ws.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data);
                if (msg.type === 'state') {
                    // Update render state from server
                    onServerState(msg);
                }
            } catch {}
        };
    }
    connect();

    // --- Client-side render state (driven by server messages) ---
    const renderState = {
        seq: 0,
        ts: 0,
        ball: { x: WIDTH/2, y: HEIGHT/2, w: 10, h: 10 },
        paddles: { A: { y: HEIGHT/2 - 30, h: 60 }, B: { y: HEIGHT/2 - 30, h: 60 } },
        scores: { A: 0, B: 0 }
    };

    function onServerState(s) {
        // Ignore stale frames
        if (typeof s.seq === 'number' && s.seq < renderState.seq) return;

        renderState.seq = s.seq ?? renderState.seq + 1;
        renderState.ts = s.ts ?? Date.now();

        if (s.ball) {
            // Server sends absolute pixel coords
            renderState.ball.x = s.ball.x;
            renderState.ball.y = s.ball.y;
            renderState.ball.w = s.ball.w ?? renderState.ball.w;
            renderState.ball.h = s.ball.h ?? renderState.ball.h;
        }
        if (s.paddles?.A) {
            renderState.paddles.A.y = s.paddles.A.y;
            renderState.paddles.A.h = s.paddles.A.h ?? renderState.paddles.A.h;
        }
        if (s.paddles?.B) {
            renderState.paddles.B.y = s.paddles.B.y;
            renderState.paddles.B.h = s.paddles.B.h ?? renderState.paddles.B.h;
        }
        if (s.scores) {
            renderState.scores.A = s.scores.A ?? renderState.scores.A;
            renderState.scores.B = s.scores.B ?? renderState.scores.B;
        }
    }

    // --- Send paddle intent to server (throttled) ---
    function sendInput(force = false) {
        const now = Date.now();
        if (!ws || ws.readyState !== 1) return;
        if (!force && now - lastSent < 50) return; // ~20 msgs/sec max
        lastSent = now;

        // Map keys to our local player's intent. Default: 'A'
        const up = keys.has('w') || keys.has('ArrowUp');
        const down = keys.has('s') || keys.has('ArrowDown');

        ws.send(JSON.stringify({
            type: 'paddle_move',
            player,
            up, down
        }));
    }

    // --- Drawing helpers (purely visual; no physics here!) ---
    function drawNet() {
        ctx.fillStyle = '#555';
        const dashH = 10, gap = 8;
        for (let y = 0; y < HEIGHT; y += dashH + gap) {
            ctx.fillRect(WIDTH / 2 - 1, y, 2, dashH);
        }
    }
    function drawScores() {
        ctx.fillStyle = '#fff';
        ctx.font = '24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(renderState.scores.A ?? 0), WIDTH / 2 - 40, 40);
        ctx.fillText(String(renderState.scores.B ?? 0), WIDTH / 2 + 40, 40);
    }
    function draw() {
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        drawNet();
        drawScores();
        // paddles
        ctx.fillStyle = '#fff';
        ctx.fillRect(10, renderState.paddles.A.y, 10, renderState.paddles.A.h);
        ctx.fillRect(WIDTH - 20, renderState.paddles.B.y, 10, renderState.paddles.B.h);
        // ball
        ctx.fillStyle = '#20C20E';
        ctx.fillRect(renderState.ball.x, renderState.ball.y, renderState.ball.w, renderState.ball.h);
        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    // --- Cleanup on unmount / HMR ---
    return function cleanup() {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        try { ws && ws.close(); } catch {}
        if (reconnectTimer) clearTimeout(reconnectTimer);
    };
}
