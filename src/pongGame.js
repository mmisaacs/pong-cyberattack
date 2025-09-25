export default function startPong() {
    const canvas = document.getElementById("pongGame");
    if (!canvas) return () => {};

    const ctx = canvas.getContext("2d");

    // Use a logical game size and scale for crisp rendering
    const LOGICAL_WIDTH = 650;
    const LOGICAL_HEIGHT = 400;

    // Fit the logical size into whatever the React canvas currently is
    // (We’ll use CSS size for layout and scale the drawing for HiDPI)
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = LOGICAL_WIDTH + "px";
    canvas.style.height = LOGICAL_HEIGHT + "px";
    canvas.width = Math.floor(LOGICAL_WIDTH * dpr);
    canvas.height = Math.floor(LOGICAL_HEIGHT * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Simple helper
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    class Element {
        constructor(options) {
            this.x = options.x;
            this.y = options.y;
            this.width = options.width;
            this.height = options.height;
            this.color = options.color || "#fff";
            this.speed = options.speed ?? 2;
            this.gravity = options.gravity ?? 0;
        }
    }

    let scoreOne = 0;
    let scoreTwo = 0;

    const paddleW = 12;
    const paddleH = 80;
    const margin = 10;

    const playerOne = new Element({
        x: margin,
        y: (LOGICAL_HEIGHT - paddleH) / 2,
        width: paddleW,
        height: paddleH,
        color: "#fff",
        speed: 6
    });

    const playerTwo = new Element({
        x: LOGICAL_WIDTH - margin - paddleW, // inside the right edge
        y: (LOGICAL_HEIGHT - paddleH) / 2,
        width: paddleW,
        height: paddleH,
        color: "#fff",
        speed: 6
    });

    const ballSize = 12;
    const ball = new Element({
        x: LOGICAL_WIDTH / 2 - ballSize / 2,
        y: LOGICAL_HEIGHT / 2 - ballSize / 2,
        width: ballSize,
        height: ballSize,
        color: "#20C20E",
        speed: 4
    });

    let vx = Math.random() < 0.5 ? -ball.speed : ball.speed;
    let vy = (Math.random() * 2 - 1) * ball.speed * 0.6;

    function resetBall(direction = 1) {
        ball.x = LOGICAL_WIDTH / 2 - ball.width / 2;
        ball.y = LOGICAL_HEIGHT / 2 - ball.height / 2;
        ball.speed = 4;
        vx = direction * ball.speed;
        vy = (Math.random() * 2 - 1) * ball.speed * 0.8;
    }

    // Input
    const keys = { w: false, s: false, ArrowUp: false, ArrowDown: false };
    const onKeyDown = (e) => {
        if (e.key in keys) keys[e.key] = true;
    };
    const onKeyUp = (e) => {
        if (e.key in keys) keys[e.key] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Draw helpers
    function drawRect(x, y, w, h, color = "#fff") {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
    }

    function drawNet() {
        const dashH = 10;
        for (let y = 0; y < LOGICAL_HEIGHT; y += dashH * 2) {
            drawRect(LOGICAL_WIDTH / 2 - 1, y, 2, dashH, "#555");
        }
    }

    function drawScores() {
        ctx.fillStyle = "#fff";
        ctx.font = "24px monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(scoreOne), LOGICAL_WIDTH / 2 - 40, 40);
        ctx.fillText(String(scoreTwo), LOGICAL_WIDTH / 2 + 40, 40);
    }

    function aabb(a, b) {
        return (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }

    // AI for playerTwo (simple: follow the ball with a cap)
    function updateAI() {
        const centerY = playerTwo.y + playerTwo.height / 2;
        if (ball.y + ball.height / 2 < centerY - 8) {
            playerTwo.y -= playerTwo.speed * 0.9;
        } else if (ball.y + ball.height / 2 > centerY + 8) {
            playerTwo.y += playerTwo.speed * 0.9;
        }
        playerTwo.y = clamp(playerTwo.y, 0, LOGICAL_HEIGHT - playerTwo.height);
    }

    let raf = null;
    function loop() {
        // Update
        if (keys.w) playerOne.y -= playerOne.speed;
        if (keys.s) playerOne.y += playerOne.speed;
        playerOne.y = clamp(playerOne.y, 0, LOGICAL_HEIGHT - playerOne.height);

        // Optional: let Arrow keys control right paddle instead of AI
        if (keys.ArrowUp || keys.ArrowDown) {
            if (keys.ArrowUp) playerTwo.y -= playerTwo.speed;
            if (keys.ArrowDown) playerTwo.y += playerTwo.speed;
            playerTwo.y = clamp(playerTwo.y, 0, LOGICAL_HEIGHT - playerTwo.height);
        } else {
            updateAI();
        }

        // Ball movement
        ball.x += vx;
        ball.y += vy;

        // Top/bottom walls
        if (ball.y <= 0) {
            ball.y = 0;
            vy = -vy;
        } else if (ball.y + ball.height >= LOGICAL_HEIGHT) {
            ball.y = LOGICAL_HEIGHT - ball.height;
            vy = -vy;
        }

        // Paddle collisions
        if (aabb(ball, playerOne)) {
            ball.x = playerOne.x + playerOne.width; // prevent sticking
            vx = Math.abs(vx) * 1.05; // bounce right, speed up a bit
            // add a little angle based on where it hit the paddle
            const hit = (ball.y + ball.height / 2) - (playerOne.y + playerOne.height / 2);
            vy = hit * 0.15;
        } else if (aabb(ball, playerTwo)) {
            ball.x = playerTwo.x - ball.width;
            vx = -Math.abs(vx) * 1.05; // bounce left, speed up a bit
            const hit = (ball.y + ball.height / 2) - (playerTwo.y + playerTwo.height / 2);
            vy = hit * 0.15;
        }

        // Scoring
        if (ball.x + ball.width < 0) {
            scoreTwo += 1;
            resetBall(1);
        } else if (ball.x > LOGICAL_WIDTH) {
            scoreOne += 1;
            resetBall(-1);
        }

        // Render
        ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        drawNet();
        drawScores();
        drawRect(playerOne.x, playerOne.y, playerOne.width, playerOne.height, playerOne.color);
        drawRect(playerTwo.x, playerTwo.y, playerTwo.width, playerTwo.height, playerTwo.color);
        drawRect(ball.x, ball.y, ball.width, ball.height, ball.color);

        raf = requestAnimationFrame(loop);
    }

    // Kick off
    resetBall(Math.random() < 0.5 ? -1 : 1);
    loop();

    // Cleanup on unmount / hot reload
    return function cleanup() {
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
    };
}

