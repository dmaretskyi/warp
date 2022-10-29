import { assert } from "../assert";
import { WObject } from "../gen/sync";
import { kWarpInner, Schema, WarpInner, WarpObject, WarpPrototype } from "../schema";
import { DataObject, DataRef } from "./data";

export class Database {

  constructor(public readonly schema: Schema) {}

  public readonly objects = new Map<string, DataRef>();
  public readonly dirtyObjects = new Set<DataObject>();

  createRef(id: string, existing?: DataRef): DataRef {
    if(existing) {
      assert(existing.id === id);
    }

    let ref = this.objects.get(id);
    if(!ref) {
      ref = new DataRef(id);
      this.objects.set(id, ref);
    }

    if(existing) {
      const currentObject = ref.getObject();
      const providedObject = existing.getObject()
      if(providedObject) {
        if(currentObject) {
          assert(currentObject === existing.getObject());
        } else  {
          this.import(providedObject);
        }
      }
    }

    return ref;
  }

  import(object: DataObject) {
    const ref = this.createRef(object.id);
    ref.fill(object);
    object.onImport(this);
    this.markDirty(object);
  }

  markDirty(object: DataObject) {
    this.dirtyObjects.add(object);
    this.flush(); // TODO: Defer.
  }

  // v1 stuff

  private replicationHook?: (mutation: WObject) => void;

  getRootObject(): DataObject | undefined {
    return Array.from(this.objects.values()).find((ref) => ref.getObject() && ref.getObject()!.getParent() === undefined)?.getObject();
  }

  getOrCreateRoot<T extends WarpObject>(prototype: WarpPrototype<T>): T {
    const root = this.getRootObject();
    if(root) {
      return root.frontend as T;
    } else {
      const instance = new prototype();
      this.import(instance[kWarpInner].data);
      return instance;
    }
  }

  flush() {
    const mutations: WObject[] = [];
    for(const id of this.dirtyObjects) {
      mutations.push(id.serialize());
    }
    this.dirtyObjects.clear();
    for(const mutation of mutations) {
      this.replicationHook?.(mutation);
    }
  }

  externalMutation(mutation: WObject) {
    const ref = this.objects.get(mutation.id!);
    if(ref?.getObject()) {
      ref.getObject()!.deserialize(mutation);
      ref.getObject()!.onImport(this);
    } else {
      const prototype = this.schema.prototypes.get(mutation.type!)!;
      const instance = new prototype();

      const inner = instance[kWarpInner];
      inner.data.id = mutation.id!;
      inner.data.deserialize(mutation);
      this.import(inner.data);
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
              if(object.getObject()) {
                this.markDirty(object.getObject()!);
              }
            }
            this.flush();
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

