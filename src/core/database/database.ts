import { assert } from "../assert";
import { WObject, ProtocolMessage } from "../gen/sync";
import { kWarpInner, WarpObject, WarpPrototype } from "./dsl";
import { DataObject, DataRef } from "./data";
import { Schema } from "./schema";

export class Database {
  constructor(public readonly schema: Schema) {}

  public readonly objects = new Map<string, DataRef>();
  public readonly dirtyObjects = new Set<DataObject>();
  public flushing?: NodeJS.Timeout;

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
    assert(object instanceof DataObject);
    const ref = this.createRef(object.id);
    ref.fill(object);
    object.markDirty(['$all']); // TODO(dmaretskyi): Don't mark as dirty if we're receiving the object from the server.
    object.database = this;
    object.updateReferences();
    this.markDirty(object);
  }

  markDirty(object: DataObject) {
    this.dirtyObjects.add(object);
    this.flushLater();
  }

  private downstreamReplication?: (mutation: WObject) => void;
  private upstreamReplication = new Set<(mutation: WObject) => void>();

  getRootObject(): DataObject | undefined {
    return Array.from(this.objects.values()).find((ref) => ref.getObject() && ref.getObject()!.getParent() === undefined)?.getObject();
  }

  getOrCreateRoot<T extends WarpObject>(prototype: WarpPrototype<T>): T {
    const root = this.getRootObject();
    if(root) {
      return root.frontend as T;
    } else {
      const instance = new prototype();
      this.import(instance[kWarpInner]);
      return instance;
    }
  }

  flushLater() {
    if(this.flushing !== undefined) {
      return;
    }
    this.flushing = setTimeout(() => {
      this.flush();
    })
  }

  flush() {
    clearTimeout(this.flushing);
    this.flushing = undefined;

    if(this.downstreamReplication) {
      for(const id of this.dirtyObjects) {
        this.downstreamReplication?.(id.serializeMutation());
      }
    }

    // upstream
    {
      const mutations: WObject[] = [];
      for(const obj of this.dirtyObjects) {
        mutations.push(obj.serialize());
      }
      
      for(const mutation of mutations) {
        for(const hook of this.upstreamReplication) {
          hook(mutation);
        }
      }
    }

    for(const obj of Array.from(this.dirtyObjects)) {
      if(obj.dirtyFields.size === 0) {
        this.dirtyObjects.delete(obj);
      }
    }
  }

  /**
   * Mutation from a server that has more authority over the data.
   */
  downstreamMutation(mutation: WObject) {
    const ref = this.objects.get(mutation.id!);
    if(ref?.getObject()) {
      const obj = ref.getObject()!

      obj.deserialize(mutation);
      obj.updateReferences();
      obj.propagateUpdate();
    } else {
      const prototype = this.schema.prototypes.get(mutation.type!)!;
      const instance = new prototype();

      const data = instance[kWarpInner];
      data.id = mutation.id!;
      data.deserialize(mutation);
      const ref = this.createRef(data.id);
      ref.fill(data);
      data.database = this;
      data.updateReferences();
      data.propagateUpdate();
    }
  }

  /**
   * Mutation from a client with less authority over the data.
   */
  upstreamMutation(mutation: WObject) {
    const ref = this.objects.get(mutation.id!);
    if(ref?.getObject()) {
      const obj = ref.getObject()!

      if(mutation.version < obj.version) {
        return;
      }

      obj.deserializeMutation(mutation);
      obj.updateReferences();
      obj.propagateUpdate();
      obj.commit();
      
      this.markDirty(obj);
    } else {
      const prototype = this.schema.prototypes.get(mutation.type!)!;
      const instance = new prototype();

      const inner = instance[kWarpInner];
      inner.id = mutation.id!;
      inner.deserializeMutation(mutation);
      this.import(inner);
    }
  }

  /**
   * Replicate with a server that has more authority over the data.
   */
  replicateDownstream(): ReplicationSocket {
    return {
      bind: ({ onMessage }) => {
        return {
          receiveMessage: (message) => {
            const protocol = ProtocolMessage.fromBinary(message);
            switch(protocol.payload.oneofKind) {
              case 'sync': {
                console.log('sync');
                break;
              }
              case 'object': {
                this.downstreamMutation(protocol.payload.object);
                break;
              }
            }
          },
          start: () => {
            assert(this.downstreamReplication === undefined, 'Only one downstream replication socket is supported');
            this.downstreamReplication = (mutation) => {
              onMessage(ProtocolMessage.toBinary({
                payload: {
                  oneofKind: 'object',
                  object: mutation,
                }
              }));
            };
    
            for(const object of this.objects.values()) {
              if(object.getObject()) {
                this.markDirty(object.getObject()!);
              }
            }
            this.flush();
          },
          stop: () => {
            this.downstreamReplication = undefined;
          }
        }
      }
    }
  }

  /**
   * Replicate with a client that forks and mutates the data (less authority).
   */
  replicateUpstream(): ReplicationSocket {
    return {
      bind: ({ onMessage }) => {
        const hook = (mutation: WObject) => {
          onMessage(ProtocolMessage.toBinary({
            payload: {
              oneofKind: 'object',
              object: mutation,
            }
          }));
        };

        return {
          receiveMessage: (message) => {
            const protocol = ProtocolMessage.fromBinary(message);
            switch(protocol.payload.oneofKind) {
              case 'sync': {
                console.log('client sync');
                break;
              }
              case 'object': {
                this.upstreamMutation(protocol.payload.object);
                break;
              }
            }
          },
          start: () => {
            this.upstreamReplication.add(hook); 
    
            for(const object of this.objects.values()) {
              if(object.getObject()) {
                this.markDirty(object.getObject()!);
              }
            }
            this.flush();
          },
          stop: () => {
            this.upstreamReplication.delete(hook);
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

