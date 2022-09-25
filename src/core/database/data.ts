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
    return this.data[key];
  }

  set(key: string, value: DataValue) {
    this.data[key] = value;
  }

  arrayPush(key: string, value: DataValue) {
    const array = this.get(key);
    assert(array instanceof DataArray);
    array.items.push(value);
  }

  setParent(parent: DataRef) {
    this.parent = parent;
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
  public readonly items: DataValue[] = [];
}