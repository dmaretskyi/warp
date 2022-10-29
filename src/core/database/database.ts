import { assert } from "../assert";
import { WObject } from "../gen/sync";
import { kWarpInner, Schema, WarpInner, WarpObject } from "../schema";
import { DataObject, DataRef } from "./data";

export class Database {

  constructor(public readonly schema: Schema) {}

  public objectsV2 = new Map<string, DataRef>();

  createRef(id: string, existing?: DataRef): DataRef {
    if(existing) {
      assert(existing.id === id);
    }

    let ref = this.objectsV2.get(id);
    if(!ref) {
      ref = new DataRef(id);
      this.objectsV2.set(id, ref);
    }

    if(existing) {
      const currentObject = ref.getObject();
      const providedObject = existing.getObject()
      if(providedObject) {
        if(currentObject) {
          assert(currentObject === existing.getObject());
        } else  {
          this.importV2(providedObject);
        }
      }
    }

    return ref;
  }

  importV2(object: DataObject) {
    const ref = this.createRef(object.id);
    ref.fill(object);
    object.onImport(this);
  }

  // v1 stuff

  private replicationHook?: (mutation: WObject) => void;

  private objects = new Map<string, WarpInner>();

  getRootObject(): WarpInner | undefined {
    return Array.from(this.objects.values()).find((object) => object.parent === undefined);
  }

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
      const parent = mutation.parent ? this.objects.get(mutation.parent) : undefined;
      object.externalMutation(mutation, parent);
    } else {
      const prototype = this.schema.prototypes.get(mutation.type!)!;
      const instance = new prototype();

      const object = instance[kWarpInner];
      object.database = this;
      object.id = mutation.id!;
      const parent = mutation.parent ? this.objects.get(mutation.parent) : undefined;
      object.externalMutation(mutation, parent);
      this.objects.set(object.id, object);
    }
  }

  replicate(): ReplicationSocket {
    return {
      bind: ({ onMessage }) => {
        return {
          receiveMessage: (message) => {
            const wobject = WObject.fromBinary(message);
            this.externalMutation(wobject);
          },
          start: () => {
            assert(this.replicationHook === undefined, 'Only one replication socket is supported');
            this.replicationHook = (mutation) => {
              onMessage(WObject.toBinary(mutation));
            };
    
            for(const object of this.objects.values()) {
              const wobject = object.serialize();
              onMessage(WObject.toBinary(wobject));
            }
          },
          stop: () => {
            this.replicationHook = undefined;
          }
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
  start: () => void;
  stop: () => void;
}

export interface ReplicationSocket {
  bind(params: BindParams): BindResult;
}

