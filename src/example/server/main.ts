import { writeFileSync, openSync, writeSync, appendFileSync } from 'fs';
import { v4 } from 'uuid';
import { WebSocket } from 'ws'
import { Database, messageToJson } from '../../core/database';
import { ProtocolMessage, WObject } from '../../core/gen/sync';
import { schema, TaskList } from '../gen/schema';

const database = new Database(schema)
const taskList = database.getOrCreateRoot(TaskList);

setInterval(() => {
  writeFileSync('data.json', JSON.stringify(taskList, null, 2))
}, 100)

writeFileSync('log.json', '');

const server = new WebSocket.Server({
  port: 1122
});

server.on('connection', function (socket) {
  const id = v4()
  console.log(`[${id}] connected`)
  try {
    const replicator = database.replicateUpstream();

    const { start, stop, receiveMessage } = replicator.bind({
      onMessage: async (message) => {
        appendFileSync('log.json', JSON.stringify({
          direction: 'up',
          client: id,
          ...messageToJson(schema, ProtocolMessage.fromBinary(message)),
        }, null, 2) + '\n')
        socket.send(message);
      }
    })


    // When you receive a message, send that message to every socket.
    socket.on('message', function (msg) {
      appendFileSync('log.json', JSON.stringify({
        direction: 'down',
        client: id,
        ...messageToJson(schema, ProtocolMessage.fromBinary(Buffer.from(msg as any))),
      }, null, 2) + '\n')
      receiveMessage(Buffer.from(msg as any));
    });

    // When a socket closes, or disconnects, remove it from the array.
    socket.on('close', function () {
      console.log(`[${id}] disconnected`)
      stop()
    });

    start()
  } catch (e) {
    console.error(e)
  }
});