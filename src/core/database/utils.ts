import { inspect } from "util";
import { ReplicationSocket } from ".";
import { WObject } from "../gen/sync";
import { Schema } from "./schema";

export function formatMutation(schema: Schema, mutation: WObject) {
  const type = schema.root.lookupType(mutation.type!);
  const state = mutation.state && type.decode(mutation.state);

  return inspect({
    ...mutation,
    state,
  }, false, null, true);
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