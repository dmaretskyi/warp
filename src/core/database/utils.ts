import { ReplicationSocket } from ".";
import { ProtocolMessage, WObject } from "../gen/sync";
import { Schema } from "./schema";

export function messageToJson(schema: Schema, message: ProtocolMessage) {
  switch(message.payload.oneofKind) {
    case 'sync': {
      return {
        sync: true,
      }
    }
    case 'object': {
      const type = schema.root.lookupType(message.payload.object.type!);
      const state = message.payload.object.state && type.decode(message.payload.object.state);
      const mutation = message.payload.object.mutation && type.decode(message.payload.object.mutation);
    
      return {
        ...message.payload.object,
        state,
        mutation,
      }
    }
  }
}

export function formatMutation(schema: Schema, message: ProtocolMessage) {
  const { inspect } = require('util');

  return inspect(messageToJson(schema, message), false, null, true);
}

export function bindReplicationSockets(left: ReplicationSocket, right: ReplicationSocket, onMessage: (direction: '>' | '<', message: Uint8Array) => void) {
  const leftResult = left.bind({
    onMessage: (message) => {
      onMessage('>', message);
      rightResult.receiveMessage(message);
    }
  });

  const rightResult = right.bind({
    onMessage: (message) => {
      onMessage('<', message);
      leftResult.receiveMessage(message);
    }
  });

  leftResult.start();
  rightResult.start();

  return () => {
    leftResult.stop();
    rightResult.stop();
  }
}

export function debugReplication(socket: ReplicationSocket, onMessage: (message: Uint8Array) => void) {
  const res = socket.bind({ onMessage });
  res.start();
  return () => res.stop()
}