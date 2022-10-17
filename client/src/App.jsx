import { SocketContext, socket } from './context/socket'
import Snake from './Snake'
import './App.css'

function App() {
  return (
    <div className="App">
      <SocketContext.Provider value={socket}>
        <Snake />
      </SocketContext.Provider>
    </div>
  )
}

export default App
