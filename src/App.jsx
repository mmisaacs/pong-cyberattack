import {useEffect} from 'react'
import './App.css'

function App() {
    useEffect(() => {
        let stop;
        import('./pongGame.js').then(mod => {
            const start = mod.default || mod.startPong;
            if (typeof start === 'function') {
                stop = start(); // start returns a cleanup function
            }
        });

    return () => {
        if (typeof stop === 'function') stop();
    };
}, []);

    return (
        <div>
            <canvas id="pongGame" width="800" height="400" style={{ background: '#000' }} />
        </div>
    )
}

export default App
