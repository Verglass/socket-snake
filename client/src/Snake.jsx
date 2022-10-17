import { useState, useEffect, useRef, useContext } from 'react'
import { SocketContext } from './context/socket.js'
import { config } from '../../config.mjs'

function Snake() {
    const socket = useContext(SocketContext)
    const [gameState, setGameState] = useState({ player1: { snake: [] }, player2: { snake: [] }, food: {}, active: false })
    const [members, setMembers] = useState([])
    const [room, setRoom] = useState('')
    const [username, setUsername] = useState('')
    const [winner, setWinner] = useState('')
    const [value, setValue] = useState('')
    const canvasRef = useRef(null)

    useEffect(() => {
        socket.on('room-joined', (room) => setRoom(room))
        socket.on('state', (state) => setGameState(state))
        socket.on('room-update', (members) => setMembers(members))
        socket.on('game-over', (winner) => setWinner(winner))

        document.addEventListener('keydown', (e) => handleKeypress(e))
    }, [])

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        const drawScale = config.scale * 0.8

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = 'darkseagreen'
        gameState.player1.snake.forEach((part) => {
            ctx.fillRect(part.x * config.scale, part.y * config.scale, drawScale, drawScale)
        })
        ctx.fillStyle = 'darkolivegreen'
        gameState.player2.snake.forEach((part) => {
            ctx.fillRect(part.x * config.scale, part.y * config.scale, drawScale, drawScale)
        })
        ctx.fillStyle = 'darkred'
        gameState.food && ctx.fillRect(gameState.food.x * config.scale, gameState.food.y * config.scale, drawScale, drawScale)
        ctx.fillStyle = 'rgba(200, 200, 200, 0.6)'
        winner && ctx.fillRect(0, 0, config.sizeX * config.scale, config.sizeY * config.scale)
    }, [gameState])

    const handleKeypress = (e) => {
        let velocity = null
        switch (e.keyCode) {
            case 38:
                velocity = {
                    x: 0,
                    y: -1,
                }
                break
            case 39:
                velocity = {
                    x: 1,
                    y: 0,
                }
                break
            case 40:
                velocity = {
                    x: 0,
                    y: 1,
                }
                break
            case 37:
                velocity = {
                    x: -1,
                    y: 0,
                }
                break
        }
        if (velocity) {
            socket.emit('direction-change', velocity)
        }
    }

    const joinRoom = () => {
        value && username && socket.emit('room-request', value, username)
        setValue('')
    }

    return (
        <div className='snake'>

            <div className='container'>
                <canvas ref={canvasRef} style={gameState.active ? {} : { display: 'none' }} width={config.sizeX * config.scale} height={config.sizeY * config.scale} ></canvas>
                {winner &&
                    <div className='endscreen'
                        style={{ width: config.sizeX * config.scale * 0.6, height: config.sizeY * config.scale * 0.6, left: config.sizeX * config.scale * 0.2, top: config.sizeY * config.scale * 0.2 }}>
                        <h2>{members[winner - 1][1]} won!</h2>
                        <button onClick={() => { socket.emit('game-start'); setWinner('') }}>Restart</button>
                        <button onClick={() => { socket.emit('room-return'); setWinner('') }}>Return to the menu</button>
                    </div>
                }
            </div>

            {!gameState.active &&
                <div>
                    {room ?
                        <div className='menu'>
                            <p>You are in room: <span className='bold'>{room}</span></p>
                            <p>Current users:</p>
                            {members.map((member) => (
                                <p className='bold' key={member[0]}>{member[1]}</p>
                            ))}
                            <button onClick={() => socket.emit('game-start')}>start</button>
                            <button onClick={() => { socket.emit('room-leave'); setRoom('') }}>back</button>
                        </div>
                        :
                        <div className='menu'>
                            <input value={username} onChange={(e) => setUsername(e.target.value)} type='text' placeholder='username'></input>
                            <input value={value} onChange={(e) => setValue(e.target.value)} type='text' placeholder='room name'></input>
                            <button onClick={joinRoom}>join</button>
                        </div>
                    }
                </div>
            }
        </div>
    )
}

export default Snake