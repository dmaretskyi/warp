import { inspect } from "util";
import { ReplicationSocket } from ".";
import { WObject } from "../gen/sync";
import { Schema } from "./schema";

export function formatMutation(schema: Schema, snapshot: WObject) {
  const type = schema.root.lookupType(snapshot.type!);
  const state = snapshot.state && type.decode(snapshot.state);
  const mutation = snapshot.mutation && type.decode(snapshot.mutation);

  return inspect({
    ...snapshot,
    state,
    mutation,
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