import React from 'react'

export default function Dashboard({ state = {}, events = [] }){
  const ball = state?.ball || { x: 0, y: 0, w: 10, h: 10 };
  const paddles = state?.paddles || { A: { y:0, h:60 }, B: { y:0, h:60 } };
  const scores = state?.scores || { A: 0, B: 0 };

  const pct = (y) => Math.max(0, Math.min(100, Math.round((y / (400 - 60)) * 100)));

  return (
    <div className="dashboard hmi">
      <div className="hmi-row">
        <section className="panel field-panel">
          <header className="panel-header">Field</header>
          <div className="panel-body field-canvas">
            <div className="net" />
            <div className="paddle paddle-A" style={{ top: paddles.A.y }}>
              <div className="badge">{Math.round(paddles.A.y)} ({pct(paddles.A.y)}%)</div>
            </div>
            <div className="paddle paddle-B" style={{ top: paddles.B.y }}>
              <div className="badge">{Math.round(paddles.B.y)} ({pct(paddles.B.y)}%)</div>
            </div>
            <div className="ball" style={{ left: ball.x, top: ball.y }} />
          </div>
        </section>

        <section className="panel telemetry-panel">
          <header className="panel-header">Telemetry</header>
          <div className="panel-body">
            <div className="telemetry-row"><strong>Score A</strong><div className="telemetry-value">{scores.A}</div></div>
            <div className="telemetry-row"><strong>Score B</strong><div className="telemetry-value">{scores.B}</div></div>
            <div className="telemetry-row"><strong>Ball</strong><div className="telemetry-value">x: {Math.round(ball.x)} y: {Math.round(ball.y)}</div></div>
            <div className="telemetry-row"><strong>Paddle A</strong><div className="telemetry-value">y: {Math.round(paddles.A.y)} ({pct(paddles.A.y)}%)</div></div>
            <div className="telemetry-row"><strong>Paddle B</strong><div className="telemetry-value">y: {Math.round(paddles.B.y)} ({pct(paddles.B.y)}%)</div></div>
          </div>
        </section>
      </div>

      <div className="hmi-row">
        <section className="panel leaderboard-panel">
          <header className="panel-header">Leaderboard</header>
          <div className="panel-body">
            <ol className="leaderboard">
              <li>Player A — {scores.A} pts</li>
              <li>Player B — {scores.B} pts</li>
            </ol>
          </div>
        </section>

        <section className="panel events-panel">
          <header className="panel-header">Events / Alerts</header>
          <div className="panel-body events-list">
            <ul>
              {events.length === 0 && <li className="muted">No events</li>}
              {events.slice().reverse().map((e, i) => (
                <li key={i} className={e.type === 'attack' ? 'alert' : ''}>
                  <div className="evt-type">{e.type}</div>
                  <div className="evt-msg">{e.msg || JSON.stringify(e)}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  )
}
