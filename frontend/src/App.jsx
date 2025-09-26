import { useEffect } from 'react'
import startPong from './pongGame'

export default function App(){
    useEffect(() => startPong('A'), []) // or 'B' on the second client
    return <canvas id="pongGame" width="650" height="400" style={{background:'#000'}}/>
}