import React, { useState, useEffect, useRef } from 'react';

export default function Dashboard() {
  const [state, setState] = useState({});
  const [events, setEvents] = useState([]);
  const [mode, setMode] = useState('Manual');
  const wsRef = useRef(null);
  const [speed, setSpeed] = useState(0);
  const [runTime, setRunTime] = useState(0);
  const prevBallRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  const toggleMode = () => setMode(prev => (prev === 'Manual' ? 'Auto' : 'Manual'));

  const HEIGHT = 400; // match backend

const sliderTop = (baseTop, paddleY) => {
  const trackHeight = 33; // percent
  const percent = paddleY / HEIGHT;
  return `${baseTop + trackHeight * percent}%`;
};


  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.hostname}:5001/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      console.log('Received message:', msg);
      if (msg.type === 'state') {
        setState({
          ball: msg.ball,
          paddles: msg.paddles,
          scores: msg.scores,
          ts: msg.ts
        });

        // Optional: log security events
        setEvents(prev => [
          { name: 'State Update', time: new Date(msg.ts).toLocaleTimeString() },
          ...prev.slice(0, 12) // limit to 10 events
        ]);
      }
    };

    ws.onclose = () => console.log('WebSocket closed');
    ws.onerror = (err) => console.error('WebSocket error:', err);

    return () => ws.close();
  }, []);
  useEffect(() => {
    const interval = setInterval(() => {
      setRunTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!prevBallRef.current || !state.ball) {
      prevBallRef.current = state.ball;
      return;
    }

    const dx = state.ball.x - prevBallRef.current.x;
    const dy = state.ball.y - prevBallRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    setSpeed(distance * 60); // assuming 60Hz updates

    prevBallRef.current = state.ball;
  }, [state.ball]);

  const scores = state.scores || { A: 0, B: 0 };
  const paddles = state.paddles || { A: { y: 0 }, B: { y: 0 } };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100vw',
      height: '100vh',
      background: '#f0f0f0',
      overflow: 'hidden'
    }}>
      <div style={{
        width: '90vw',
        height: '60vw', // maintains 1125x750 ratio
        maxHeight: '100vh',
        position: 'relative',
      }}>
        {/* ✅ All your layout panels go here — no nesting */}
        {/* Header */}
        <div style={{ width: '100%', height: '10.5%', left: '0%', top: '0%', position: 'absolute', background: '#D9D9D9' }} />
        <div style={{ width: '100%', height: '5%', left: '0%', top: '10.5%', position: 'absolute', background: '#79C57F' }} />
        <div style={{ width: '100%', height: '3%', left: '5%', top: '10.5%', position: 'absolute', textAlign: 'left', color: 'black', fontSize: '1.5vw', fontFamily: 'Handjet', fontWeight: '600' }}>WorkCentre: BillyBronco1</div>
        <div style={{ width: '100%', height: '3%', left: '0%', top: '10.5%', position: 'absolute', textAlign: 'center', color: 'black', fontSize: '1.5vw', fontFamily: 'Handjet', fontWeight: '600' }}>Status: 5. Loaded</div>
        <div style={{ width: '100%', height: '3%', right: '5%', top: '10.5%', position: 'absolute', textAlign: 'right', color: 'black', fontSize: '1.5vw', fontFamily: 'Handjet', fontWeight: '600' }}>Hey, Cyber Security Awareness Fair!</div>
        <div style={{
          width: '100%',
          height: '7%',
          left: '0%',
          top: '1%',
          position: 'absolute',
          textAlign: 'center',
          justifyContent: 'center',
          display: 'flex',
          flexDirection: 'column',
          color: 'black',
          fontSize: '4vw',
          fontFamily: 'Handjet',
          fontWeight: '400',
          letterSpacing: '0.85vw'
        }}>
          pong dashboard
        </div>

        {/* Ball Panel */}
        <div style={{ width: '19%', height: '42%', left: '0%', top: '19%', position: 'absolute', background: '#D9D9D9' }} />
        <div style={{ width: '19%', height: '6%', left: '0%', top: '19%', position: 'absolute', background: '#79C57F' }} />
        <div style={{ width: '17%', height: '25%', left: '1%', top: '28%', position: 'absolute', color: 'black', fontSize: '1.5vw', fontFamily: 'Handjet', fontWeight: '400' }}>
          Speed: {speed.toFixed(2)} px/sec<br /><br />
          P1 score: {scores.A}<br /><br />
          P2 score: {scores.B}<br /><br />
          Total run time: {runTime}s
        </div>
        <div style={{ width: '17%', height: '3%', left: '1%', top: '19%', position: 'absolute', textAlign: 'center', color: 'black', fontSize: '2vw', fontFamily: 'Handjet', fontWeight: '600' }}>Ball</div>

        {/* Player 1 Panel */}
        <div style={{ width: '19%', height: '42%', left: '24%', top: '19%', position: 'absolute', background: '#D9D9D9' }} />
        <div style={{ width: '19%', height: '6%', left: '24%', top: '19%', position: 'absolute', background: '#79C57F' }} />
        <div style={{ width: '17%', height: '3%', left: '25%', top: '19%', position: 'absolute', textAlign: 'center', color: 'black', fontSize: '2vw', fontFamily: 'Handjet', fontWeight: '600' }}>Player 1 Location</div>
        <div style={{ width: '17%', height: '33%', left: '25%', top: '26%', position: 'absolute', background: '#F0F0F0' }} />
        <div style={{ width: '2%', height: '33%', left: '32.5%', top: '26%', position: 'absolute', background: '#B4C8AE' }} />
        {/* Player 1 Slider */}
<div style={{
  width: '8%',
  height: '3%',
  left: '29.5%',
  top: sliderTop(26, paddles.A.y),
  position: 'absolute',
  background: '#50AB57',
  transition: 'top 0.1s ease'
}} />


        {/* Player 2 Panel */}
        <div style={{ width: '19%', height: '42%', left: '49%', top: '19%', position: 'absolute', background: '#D9D9D9' }} />
        <div style={{ width: '19%', height: '6%', left: '49%', top: '19%', position: 'absolute', background: '#79C57F' }} />
        <div style={{ width: '17%', height: '3%', left: '50%', top: '19%', position: 'absolute', textAlign: 'center', color: 'black', fontSize: '2vw', fontFamily: 'Handjet', fontWeight: '600' }}>Player 2 Location</div>
        <div style={{ width: '17%', height: '33%', left: '50%', top: '26%', position: 'absolute', background: '#F0F0F0' }} />
        <div style={{ width: '2%', height: '33%', left: '57.5%', top: '26%', position: 'absolute', background: '#B4C8AE' }} />

{/* Player 2 Slider */}
<div style={{
  width: '8%',
  height: '3%',
  left: '54.5%',
  top: sliderTop(26, paddles.B.y),
  position: 'absolute',
  background: '#50AB57',
  transition: 'top 0.1s ease'
}} />


        {/* Security Events */}
        <div style={{ width: '28%', height: '75%', left: '72%', top: '19%', position: 'absolute', background: '#D9D9D9' }} />
        <div style={{ width: '28%', height: '6%', left: '72%', top: '19%', position: 'absolute', background: '#79C57F' }} />
        <div style={{
          width: '26%',
          height: '60%',
          left: '73%',
          top: '32%',
          position: 'absolute',
          overflowY: 'auto',
          fontSize: '1.5vw',
          fontFamily: 'Handjet',
          color: 'black'
        }}>
          {events.map((event, idx) => (
            <div key={idx}>🟢 {event.name} – {event.time}</div>
          ))}
        </div>
        <div style={{ width: '28%', height: '5%', left: '72%', top: '19%', position: 'absolute', textAlign: 'center', color: 'black', fontSize: '2vw', fontFamily: 'Handjet', fontWeight: '600' }}>Security Events</div>

        {/* Service Uptime Panel */}
        <div style={{ width: '44%', height: '29%', left: '24%', top: '64%', position: 'absolute', background: '#D9D9D9' }} />
        <div style={{ width: '44%', height: '6%', left: '24%', top: '64%', position: 'absolute', background: '#79C57F' }} />
        <div style={{ width: '36%', height: '5%', left: '27%', top: '65%', position: 'absolute', textAlign: 'center', color: 'black', fontSize: '2vw', fontFamily: 'Handjet', fontWeight: '600' }}>Service Uptime</div>
        <img style={{ width: '41%', height: '21%', left: '25.5%', top: '71%', position: 'absolute' }} src="https://en.meming.world/images/en/8/81/Stonks.jpg" alt="Service Uptime" />

        {/* Mode Panel */}
        <div style={{
          width: '19%',
          height: '29%',
          left: '0%',
          top: '64%',
          position: 'absolute',
          background: '#D9D9D9'
        }}>
          {/* Title*/}
          <div style={{
            width: '100%',
            height: '5%',
            position: 'absolute',
            top: '1%',
            textAlign: 'center',
            color: 'black',
            fontSize: '2vw',
            fontFamily: 'Handjet',
            fontWeight: '600'
          }}>
            Current Mode
          </div>

          {/* Mode Value */}
          <div style={{
            position: 'absolute',
            top: '25%',
            width: '100%',
            textAlign: 'center',
            fontSize: '2vw',
            fontFamily: 'Handjet',
            fontWeight: 600,
            color: 'black'
          }}>
            {mode}
          </div>

          {/* Toggle Switch */}
          <div
            onClick={toggleMode}
            style={{
              position: 'absolute',
              top: '45%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '60px',
              height: '30px',
              background: mode === 'Manual' ? '#50AB57' : '#AB5050',
              borderRadius: '9999px',
              boxShadow: 'inset 0px 2px 2px rgba(0, 0, 0, 0.25)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: mode === 'Manual' ? 'flex-start' : 'flex-end',
              padding: '0 5px',
              transition: 'background 0.3s ease'
            }}
          >
            <div style={{
              width: '20px',
              height: '20px',
              background: '#fff',
              borderRadius: '50%'
            }} />
          </div>

          {/* Hint Text */}
          <div style={{
            position: 'absolute',
            bottom: '8%',
            width: '100%',
            textAlign: 'center',
            fontSize: '1.2vw',
            color: 'rgba(0, 0, 0, 0.5)',
            fontFamily: 'Handjet'
          }}>
            (click to toggle)
          </div>
        </div>


      </div>
    </div>
  );
}