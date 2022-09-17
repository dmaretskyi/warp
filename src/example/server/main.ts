import { WebSocket } from 'ws'
import { Database } from '../../core/database';
import { schema } from '../gen/warp-example-task_list';

const database = new Database(schema)

const server = new WebSocket.Server({
  port: 1122
});

server.on('connection', function (socket) {
  console.log('new client')
  try {


    const replicator = database.replicate();

    const { start, stop, receiveMessage } = replicator.bind({
      onMessage: async (message) => {
        socket.send(message);
      }
    })


    // When you receive a message, send that message to every socket.
    socket.on('message', function (msg) {
      receiveMessage(Buffer.from(msg as any));
    });

    // When a socket closes, or disconnects, remove it from the array.
    socket.on('close', function () {
      console.log('client disconnected')
      stop()
    });

    start()
  } catch (e) {
    console.error(e)
  }
});