import { useEffect, useRef, useState } from 'react'
import startPong from './pongGame'
import Dashboard from './Dashboard'

function navigate(path) {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new Event('popstate'))
}

export default function App(){
    const [path, setPath] = useState(window.location.pathname)
    const [state, setState] = useState(null)
    const [events, setEvents] = useState([])
    const cleanupRef = useRef(null)

    useEffect(() => {
        const onPop = () => setPath(window.location.pathname)
        window.addEventListener('popstate', onPop)
        return () => window.removeEventListener('popstate', onPop)
    }, [])

    // (Re)start Pong whenever the route changes so drawing attaches to the canvas if present.
    useEffect(() => {
        // stop any previous instance
        cleanupRef.current?.()

        // start a fresh instance; 'both' = W/S control A, ↑/↓ control B from this tab
        cleanupRef.current = startPong('both', (msg) => {
            if (msg.type === 'state') setState(msg.state)
            if (msg.type === 'event') setEvents((s) => [
                ...s,
                { type: msg.event.type, msg: msg.event.message || msg.event.payload || msg.event }
            ])
        })

        return () => cleanupRef.current?.()
    }, [path])

    return (
        <div>
            <nav style={{ marginBottom: 12 }}>
                <button onClick={() => navigate('/')} disabled={path === '/'}>Game</button>
                <button onClick={() => navigate('/dashboard')} disabled={path === '/dashboard'} style={{ marginLeft: 8 }}>
                    Dashboard
                </button>
            </nav>

            {path === '/' && (
                <canvas id="pongGame" width="650" height="400" style={{ background:'#000' }} />
            )}

            {path === '/dashboard' && (
                <Dashboard state={state} events={events} />
            )}
        </div>
    )
}
