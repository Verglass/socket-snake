import { Server } from "socket.io"
import { config } from "../config.mjs"

const io = new Server(5000, {
    cors: {
        origin: 'http://localhost:3000'
    }
})

const stateMap = new Map()
const roomMap = new Map()
const usernameMap = new Map()

io.on('connection', (socket) => {
    console.log(`connnected user ${socket.id}`)

    socket.on('room-request', (room, username) => {
        usernameMap.set(socket.id, username)
        if (!io.of('/').adapter.rooms.get(room)) {
            joinRoom(socket, room, 'player1')
        } else if (io.of('/').adapter.rooms.get(room).size === 1) {
            joinRoom(socket, room, 'player2')
        }
    })

    socket.on('direction-change', (newVelocity) => {
        const velocity = stateMap.get(roomMap.get(socket.id))[socket.player].velocity
        if (newVelocity.x !== velocity.x * -1) {
            velocity.x = newVelocity.x
        }
        if (newVelocity.y !== velocity.y * -1) {
            velocity.y = newVelocity.y
        }
    })

    socket.on('game-start', () => {
        const room = roomMap.get(socket.id)
        if (io.of('/').adapter.rooms.get(room) && io.of('/').adapter.rooms.get(room).size === 2) {
            stateMap.set(room, createState())
            io.in(room).emit('state', stateMap.get(room))

            const gameLoop = setInterval(() => {
                stateMap.set(room, move(stateMap.get(room), 'player1', socket, gameLoop))
                stateMap.set(room, move(stateMap.get(room), 'player2', socket, gameLoop))
                io.to(room).emit('state', stateMap.get(room))
            }, 1000 / config.frameRate)
        }
    })

    socket.on('room-return', () => {
        const room = roomMap.get(socket.id)
        const newState = { player1: { snake: [] }, player2: { snake: [] }, food: {}, active: false }
        stateMap.set(room, newState)
        io.to(room).emit('state', stateMap.get(room))
    })

    socket.on('room-leave', () => {
        leaveRooms(socket)
    })
})

const createState = () => {
    const x1 = getRandomInt(1, Math.trunc(config.sizeX / 2))
    const y1 = getRandomInt(1, config.sizeY - 1)

    const x2 = getRandomInt(Math.trunc(config.sizeX / 2), config.sizeX - 1)
    const y2 = getRandomInt(1, config.sizeY - 1)

    let state = {
        player1: {
            velocity: {
                x: 1,
                y: 0,
            },
            snake: Array(2).fill().map((_val, idx) => {
                return {
                    x: x1 + idx,
                    y: y1,
                }
            }),
        },
        player2: {
            velocity: {
                x: -1,
                y: 0,
            },
            snake: Array(2).fill().map((_val, idx) => {
                return {
                    x: x2 - idx,
                    y: y2,
                }
            }),
        },
        food: {
            x: null,
            y: null,
        },
        active: true,
    }

    createFood(state)

    return state
}

const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min)
}

const move = (state, player, socket, gameLoop) => {
    const head = state[player].snake.at(-1)
    let newHead = { x: head.x, y: head.y }

    newHead.x += state[player].velocity.x
    newHead.y += state[player].velocity.y

    newHead.x = newHead.x >= config.sizeX ? 0 : newHead.x < 0 ? config.sizeX - 1 : newHead.x
    newHead.y = newHead.y >= config.sizeY ? 1 : newHead.y < 1 ? config.sizeY - 1 : newHead.y

    const collision = checkCollision(state, newHead.x, newHead.y)
    if (collision === 'food') {
        state[player].snake.push(newHead)
        createFood(state)
    }
    else if (collision === 'snake') {
        const winner = player === 'player1' ? 2 : 1
        const room = roomMap.get(socket.id)
        io.in(room).emit('game-over', winner)
        clearInterval(gameLoop)
    } else {
        for (let i = 0; i < state[player].snake.length - 1; i++) {
            state[player].snake[i].x = state[player].snake[i + 1].x
            state[player].snake[i].y = state[player].snake[i + 1].y
        }
        state[player].snake.pop()
        state[player].snake.push(newHead)
    }

    return state
}

const createFood = (state) => {
    const x = getRandomInt(0, config.sizeX - 1)
    const y = getRandomInt(0, config.sizeY - 1)

    if (checkCollision(state, x, y)) {
        createFood(state)
    } else {
        state.food = {
            x: x,
            y: y,
        }
    }
}

const checkCollision = (state, x, y) => {
    if (isPointInArray(state.player1.snake, x, y) || isPointInArray(state.player2.snake, x, y)) {
        return 'snake'
    } else if (state.food.x === x && state.food.y === y) {
        return 'food'
    } else {
        return null
    }
}

const isPointInArray = (arr, x, y) => {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].x === x) {
            if (arr[i].y === y) {
                return true
            }
        }
    }
    return false
}

const joinRoom = (socket, room, player) => {
    leaveRooms(socket)
    socket.join(room)
    roomMap.set(socket.id, room)
    socket.player = player
    socket.emit('room-joined', room)
    updateMembers(room)
}

const updateMembers = (room) => {
    const members = []
    const sids = io.of('/').adapter.rooms.get(room)

    if (sids) {
        for (let sid of sids) {
            members.push([sid, usernameMap.get(sid)])
        }
    }

    io.in(room).emit('room-update', members)
}

const leaveRooms = (socket) => {
    Array.from(io.of('/').adapter.sids.get(socket.id)).filter((room) => room !== socket.id).forEach((room) => {
        socket.leave(room)
        updateMembers(room)
    })
}
