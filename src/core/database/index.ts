import { assert } from "console";
import { WObject } from "../gen/sync";
import { kWarpInner, Schema, WarpInner, WarpObject } from "../schema";
import { formatMutation } from "./utils";

export class Database {
  private replicationHook?: (mutation: WObject) => void;

  constructor(public readonly schema: Schema) {}

  private objects = new Map<string, WarpInner>();

  import(object: WarpObject) {
    const inner = object[kWarpInner];

    inner.database = this;
    this.objects.set(inner.id, inner);
    inner.flush()
  }

  mutate(mutation: WObject) {
    this.replicationHook?.(mutation);
  }

  externalMutation(mutation: WObject) {
    const object = this.objects.get(mutation.id!);
    if(object) {
      object.externalMutation(mutation);
    } else {
      const object = new WarpInner(this.schema.root.lookupType(mutation.type!));
      object.database = this;
      object.id = mutation.id!;
      object.externalMutation(mutation);
      this.objects.set(object.id, object);
    }
  }

  replicate(): ReplicationSocket {
    return {
      bind: ({ onMessage }) => {
        assert(this.replicationHook === undefined, 'Only one replication socket is supported');
        this.replicationHook = (mutation) => {
          onMessage(WObject.toBinary(mutation));
        };

        for(const object of this.objects.values()) {
          const wobject = object.serialize();
          onMessage(WObject.toBinary(wobject));
        }
        
        return {
          receiveMessage: (message) => {
            const wobject = WObject.fromBinary(message);
            this.externalMutation(wobject);
          },
        }
      }
    }
  }
}

export interface BindParams {
  onMessage: (message: Uint8Array) => void;
}

export interface BindResult {
  receiveMessage: (message: Uint8Array) => void;
}

export interface ReplicationSocket {
  bind(params: BindParams): BindResult;
}

