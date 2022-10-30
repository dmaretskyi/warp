import { Database } from ".";
import { WObject } from "../gen/sync";
import { Schema } from "./schema";

export function createClient(schema: Schema, url: string) {
  console.log('create client', url);

  const database = new Database(schema);
  const replicator = database.replicateDownstream();

  const socket = new WebSocket(url);

  socket.onopen = () => {
    const { start, stop, receiveMessage } = replicator.bind({
      onMessage: async (message) => {
        formatMutation(schema, WObject.fromBinary(message), '<');
        console.log(database)
        socket.send(message);
      }
    })

    socket.addEventListener("message", async (event) => {
      if(event.data instanceof Blob) {
        const buf = new Uint8Array(await event.data.arrayBuffer());
        formatMutation(schema, WObject.fromBinary(buf), '>');
        receiveMessage(buf);
        console.log(database)
      }
    })

    socket.onclose = () => {
      stop();
    }

    start()
  }

  return database;
}


function formatMutation(schema: Schema, mutation: WObject, tag: string) {
  const type = schema.root.lookupType(mutation.type!);
  const state = mutation.state && type.decode(mutation.state);

  return console.log(tag, {
    ...mutation,
    state,
  });
}