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
    public readonly id: string,
  ) {}

  private database?: Database;
  private parent?: DataRef;
  private data: Record<string, DataValue> = {};

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
    this.data[key] = value;
  }

  arrayPush(key: string, value: DataValue) {
    const array = this.get(key);
    assert(array instanceof DataArray);
    array.items.push(value);
  }

  getParent() {
    return this.parent;
  }

  setParent(parent: DataRef) {
    this.parent = parent;
  }

  onImport(database: Database) {
    this.database = database;

    if(this.parent) {
      this.parent = database.createRef(this.parent.id, this.parent);
    }

    for(const field of this.schemaType.fieldsArray) {
      const value = this.get(field.name);
      if(value instanceof DataRef) {
        this.set(field.name, database.createRef(value.id, value));
      } else if(value instanceof DataArray) {
        for(let i = 0; i < value.items.length; i++) {
          const item = value.items[i];
          if(item instanceof DataRef) {
            value.items[i] = database.createRef(item.id, item);
          }
        }
      }
    }
  }

  /**
   * Return pending mutations for this object.
   */
  flush(): WObject {
    return WObject.create();
  }

  /**
   * Apply external mutation to this object.
   */
  applyMutation(mutation: WObject) {

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
    assert(this.object === undefined);
    assert(object.id === this.id);

    this.object = object;
    
    return this;
  }
}

export class DataArray {
  constructor(
    public readonly ownerObject: DataObject,
  ) {}

  public readonly items: DataValue[] = [];
}