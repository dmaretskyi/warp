import { inspect } from "util";
import { ReplicationSocket } from ".";
import { WObject } from "../gen/sync";
import { Schema } from "../schema";

export function formatMutation(schema: Schema, mutation: WObject) {
  const type = schema.root.lookupType(mutation.type!);
  const state = mutation.state && type.decode(mutation.state);

  return inspect({
    ...mutation,
    state,
  }, false, null, true);
}

export function bindReplicationSockets(left: ReplicationSocket, right: ReplicationSocket, schema: Schema) {
  const leftResult = left.bind({
    onMessage: (message) => {
      console.log('> ', formatMutation(schema, WObject.fromBinary(message)));
      rightResult.receiveMessage(message);
    }
  });

  const rightResult = right.bind({
    onMessage: (message) => {
      console.log('< ', formatMutation(schema, WObject.fromBinary(message)));
      leftResult.receiveMessage(message);
    }
  });
}

export function debugReplication(socket: ReplicationSocket, schema: Schema) {
  socket.bind({
    onMessage: (message) => {
      console.log(formatMutation(schema, WObject.fromBinary(message)));
    }
  });
}