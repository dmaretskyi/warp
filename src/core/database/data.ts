import * as pb from 'protobufjs'
import { assert } from '../assert';
import { WObject } from '../gen/sync';
import { Database } from './database';

export type DataValue = 
  | string
  | number
  | boolean
  | undefined
  | DataRef
  | DataArray;

export class DataObject {
  constructor(
    public readonly schemaType: pb.Type,
    public id: string,
  ) {}

  get typeName() {
    return this.schemaType.fullName.slice(1);
  }

  public database?: Database;
  private parent?: DataRef;
  private data: Record<string, DataValue> = {};
  public version: number = 0;

  public readonly updateListeners = new Set<() => void>();

  /**
   * Generated frontend object with getters and setters for each field.
   */
  public frontend?: any;

  get(key: string): DataValue {
    const value = this.data[key];
    if(value) {
      return value;
    }

    assert(this.schemaType.fields[key], `Unknown field: ${key}`);
    if(this.schemaType.fields[key].repeated) {
      return (this.data[key] = new DataArray(this));
    } else {
      return (this.data[key] = this.schemaType.fields[key].defaultValue);
    }
  }

  set(key: string, value: DataValue) {
    if(value instanceof DataArray) {
      value.ownerObject = this;
    }
    this.data[key] = value;
  }

  getParent() {
    return this.parent;
  }

  setParent(parent: DataRef) {
    this.parent = parent;
  }

  public markDirty() {
    this.database?.markDirty(this);
  }

  public propagateUpdate() {
    for(const listener of this.updateListeners) {
      listener();
    }
    if(this.parent?.getObject()) {
      this.parent.getObject()!.propagateUpdate();
    }
  }

  updateReferences() {
    if(!this.database) {
      return;
    }

    if(this.parent) {
      this.parent = this.database.createRef(this.parent.id, this.parent);
    }

    for(const field of this.schemaType.fieldsArray) {
      if(field.name === 'id') {
        continue;
      }
      const value = this.get(field.name);
      if(value instanceof DataRef) {
        this.set(field.name, this.database.createRef(value.id, value));
      } else if(value instanceof DataArray) {
        for(let i = 0; i < value.items.length; i++) {
          const item = value.items[i];
          if(item instanceof DataRef) {
            value.items[i] = this.database.createRef(item.id, item);
          }
        }
      }
    }
  }

  serialize(): WObject {
    return WObject.create({
      id: this.id,
      type: this.typeName,
      version: this.version,
      parent: this.parent?.id,
      state: this.schemaType.encode(serializationPreprocess(this.data)).finish(),
    })
  }

  deserialize(snapshot: WObject) {
    assert(snapshot.id === this.id);

    this.parent = snapshot.parent ? new DataRef(snapshot.parent) : undefined;
    this.version = snapshot.version;
    this.data = deserializationPostprocess(this.schemaType.toObject(this.schemaType.decode(snapshot.state)), this) as any;
  }

  serializeMutation(): WObject {
    // TODO(dmaretskyi): Dirty fields.
    return WObject.create({
      id: this.id,
      type: this.typeName,
      version: this.version,
      parent: this.parent?.id,
      mutation: this.schemaType.encode(serializationPreprocess(this.data)).finish(),
    })
  }

  deserializeMutation(snapshot: WObject) {
    assert(snapshot.id === this.id);

    this.parent = snapshot.parent ? new DataRef(snapshot.parent) : undefined;
    this.data = Object.assign(this.data, deserializationPostprocess(this.schemaType.toObject(this.schemaType.decode(snapshot.mutation)), this));
  }

  commit() {
    this.version++;
  }
}

function serializationPreprocess(data: DataValue | Record<string, DataValue>): any {
  if(data instanceof DataRef) {
    return { id: data.id };
  } else if(data instanceof DataArray) {
    return data.items.map(serializationPreprocess);
  } else if(typeof data === 'object') {
    const res: Record<string, any> = {};
    for(const key of Object.keys(data)) {
      res[key] = serializationPreprocess(data[key]);
    }
    return res;
  } else {
    return data;
  }
}

function deserializationPostprocess(data: any, owner: DataObject): DataValue | Record<string, DataValue> {
  if(data.id) {
    return new DataRef(data.id);
  } else if(Array.isArray(data)) {
    const array = new DataArray(owner);
    for(const item of data) {
      array.items.push(deserializationPostprocess(item, owner) as any);
    }
    return array;
  } else if(typeof data === 'object') {
    const res: Record<string, DataValue> = {};
    for(const key of Object.keys(data)) {
      res[key] = deserializationPostprocess(data[key], owner) as any;
    }
    return res;
  } else {
    return data;
  }
}

export class DataRef {
  constructor(
    public readonly id: string,
  ) {}

  private object?: DataObject;

  getObject(): DataObject | undefined {
    return this.object;
  }

  fill(object: DataObject): this {
    assert(this.object === undefined || this.object === object);
    assert(object.id === this.id);

    this.object = object;
    
    return this;
  }
}

export class DataArray {
  constructor(
    public ownerObject?: DataObject,
  ) {}

  public readonly items: DataValue[] = [];
}