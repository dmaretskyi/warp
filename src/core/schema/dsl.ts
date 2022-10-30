import { Schema } from "./schema";
import * as uuid from 'uuid';
import * as pb from 'protobufjs';
import { Database } from "../database";
import { WObject } from "../gen/sync";
import { inspect } from "util";
import { assert } from "../assert";
import { DataArray, DataObject, DataRef, DataValue } from "../database/data";

export interface WarpPrototype<T extends WarpObject = WarpObject> {
  new (opts?: Record<string, unknown>): T

  readonly type: pb.Type
  readonly typeName: string;
}

export function generateObjectPrototype(schema: Schema, name: string): WarpPrototype {
  const type = schema.root.lookupType(name);

  if(!type.fields['id']) {
    throw new Error(`Type ${name} does not have an id field`);
  }

  const klass = class extends WarpObject {
    static readonly type = type;
    static readonly typeName = name;

    constructor(opts?: Record<string, unknown>) {
      super();
      this[kWarpInner] = new DataObject(type, uuid.v4());
      this[kWarpInner].frontend = this;
      if(opts) {
        for(const key in opts) {
          this[kWarpInner].set(key, wrapData(opts[key]));
        }
      }
    }
  }
  

  for(const field of type.fieldsArray) {
    field.resolve();
    if(field.repeated) {
      Object.defineProperty(klass.prototype, field.name, {
        get(this: WarpObject) {
          return unwrapData(this[kWarpInner].get(field.name))
        },
        set(this: WarpObject, value: unknown) {
          this[kWarpInner].set(field.name, wrapData(value));
          if(this[kWarpInner].database) {
            this[kWarpInner].database.import(this[kWarpInner]);
          }
          this[kWarpInner].propagateUpdate();
        },
      })  
    } else if(field.resolvedType instanceof pb.Type) {
      Object.defineProperty(klass.prototype, field.name, {
        get(this: WarpObject) {
          return unwrapData(this[kWarpInner].get(field.name))
        },
        set(this: WarpObject, value: WarpObject) {
          this[kWarpInner].set(field.name, wrapData(value));
          value[kWarpInner].setParent(new DataRef(this.id).fill(this[kWarpInner]));
          if(this[kWarpInner].database) {
            this[kWarpInner].database.import(this[kWarpInner]);
          }
          this[kWarpInner].propagateUpdate();
        },
      })
    } else if(field.name === 'id') {
      Object.defineProperty(klass.prototype, 'id', {
        get(this: WarpObject) {
          return this[kWarpInner].id;
        },
      })
    } else {
      Object.defineProperty(klass.prototype, field.name, {
        get(this: WarpObject) {
          return this[kWarpInner].get(field.name);
        },
        set(this: WarpObject, value: unknown) {
          assert(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
          this[kWarpInner].set(field.name, value);
          this[kWarpInner].propagateUpdate();
        },
      }) 
    }
  }

  return klass;
}

export const kWarpInner = Symbol('WarpInner');


export class WarpObject {
  protected [kWarpInner]!: DataObject;

  declare readonly id: string;

  constructor() {}

  toJSON() {
    const res: any = {};
    res.id = this.id;
    res['@type'] = this[kWarpInner].typeName;
    for(const field of this[kWarpInner].schemaType.fieldsArray) {
      if(field.name === 'id') {
        continue;
      }

      const value = unwrapData(this[kWarpInner].get(field.name))
      if(value instanceof WarpObject) {
        res[field.name] = value.toJSON();
      } else if(value instanceof WarpList) {
        res[field.name] = value.map((v) => {
          if(v instanceof WarpObject) {
            return v.toJSON();
          } else {
            return v;
          }
        });
      } else {
        res[field.name] = value;
      }
    }
    return res;
  }
}

export type LinkSlot = { value?: WarpObject }


export function onUpdate(obj: WarpObject, callback: () => void) {
  obj[kWarpInner].updateListeners.add(callback);
  return () => {
    obj[kWarpInner].updateListeners.delete(callback);
  }
}


function wrapData(value: unknown): DataValue {
  if(value instanceof WarpObject) {
    return new DataRef(value.id).fill(value[kWarpInner]);
  } else if(value instanceof WarpList) {
    return value.data;
  } else if(Array.isArray(value)) {
    const array = new DataArray();
    array.items.push(...value.map(wrapData));
    return array
  } else {
    return value as DataValue;
  }
}

function unwrapData(value: DataValue): any {
  if(value instanceof DataRef) {
    return value.getObject()?.frontend;
  } else if(value instanceof DataArray) {
    return new WarpList(value);
  } else {
    return value;
  }
}

export class WarpList<T> implements Array<T> {
  static create<T>(...items: T[]): WarpList<T> {
    const data = new DataArray();
    data.items.push(...items.map(item => {
      if(item instanceof WarpObject) {
        return new DataRef(item.id).fill(item[kWarpInner]);
      }
      return item as DataValue;
    }))
    return new WarpList(data);
  }

  constructor(
    public readonly data: DataArray,
  ) {

    return new Proxy(this, {
      get: (target, key) => {
        if(typeof key === 'string' && key.match(/^\d+$/)) {
          return unwrapData(this.data.items[parseInt(key)]);
        }

        return Reflect.get(target, key);
      },
      set: (target, key, value) => {
        if(typeof key === 'string' && key.match(/^\d+$/)) {
          const wrapped = wrapData(value);
          this.data.items[parseInt(key)] = wrapped;
          if(wrapped instanceof DataRef && wrapped.getObject()) {
            this.data.ownerObject?.database?.import(wrapped.getObject()!);
          }
          this.data.ownerObject?.markDirty()
          this.data.ownerObject?.propagateUpdate();
          return true;
        } else {
          return Reflect.set(target, key, value);
        }

      },
    })
  }


  [n: number]: T 

  get length(): number {
    return this.data.items.length;
  }
  toString(): string {
    throw new Error("Method not implemented.");
  }
  toLocaleString(): string {
    throw new Error("Method not implemented.");
  }
  pop(): T | undefined {
    throw new Error("Method not implemented.");
  }
  push(...items: T[]): number {
    const newItems = items.map(wrapData);
    for(const item of newItems) {
      if(item instanceof DataRef && item.getObject() && this.data.ownerObject) {
        item.getObject()!.setParent(new DataRef(this.data.ownerObject.id).fill(this.data.ownerObject));
        item.getObject()!.markDirty();
        this.data.ownerObject?.database?.import(item.getObject()!);
      }
    }
    const res = this.data.items.push(...newItems);
    this.data.ownerObject?.markDirty();
    this.data.ownerObject?.propagateUpdate();
    return res;
  }
  concat(...items: ConcatArray<T>[]): T[];
  concat(...items: (T | ConcatArray<T>)[]): T[];
  concat(...items: unknown[]): T[] {
    throw new Error("Method not implemented.");
  }
  join(separator?: string | undefined): string {
    throw new Error("Method not implemented.");
  }
  reverse(): T[] {
    throw new Error("Method not implemented.");
  }
  shift(): T | undefined {
    throw new Error("Method not implemented.");
  }
  slice(start?: number | undefined, end?: number | undefined): T[] {
    throw new Error("Method not implemented.");
  }
  sort(compareFn?: ((a: T, b: T) => number) | undefined): this {
    throw new Error("Method not implemented.");
  }
  splice(start: unknown, deleteCount?: unknown, ...rest: unknown[]): T[] {
    throw new Error("Method not implemented.");
  }
  unshift(...items: T[]): number {
    throw new Error("Method not implemented.");
  }
  indexOf(searchElement: T, fromIndex?: number | undefined): number {
    throw new Error("Method not implemented.");
  }
  lastIndexOf(searchElement: T, fromIndex?: number | undefined): number {
    throw new Error("Method not implemented.");
  }
  every<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): this is S[];
  every(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean;
  every(predicate: unknown, thisArg?: unknown): boolean {
    throw new Error("Method not implemented.");
  }
  some(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean {
    throw new Error("Method not implemented.");
  }
  forEach(callbackfn: (value: T, index: number, array: T[]) => void, thisArg?: any): void {
    throw new Error("Method not implemented.");
  }
  map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): U[] {
    return this.data.items.map((item, index) => callbackfn(unwrapData(item) as T, index, this));
  }
  filter<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): S[];
  filter(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): T[];
  filter<S>(predicate: unknown, thisArg?: unknown): T[] | S[] {
    throw new Error("Method not implemented.");
  }
  reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T;
  reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initialValue: T): T;
  reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U;
  reduce<U>(callbackfn: unknown, initialValue?: unknown): T | U {
    throw new Error("Method not implemented.");
  }
  reduceRight(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T;
  reduceRight(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initialValue: T): T;
  reduceRight<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U;
  reduceRight<U>(callbackfn: unknown, initialValue?: unknown): T | U {
    throw new Error("Method not implemented.");
  }
  find<S extends T>(predicate: (this: void, value: T, index: number, obj: T[]) => value is S, thisArg?: any): S | undefined;
  find(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): T | undefined;
  find<S>(predicate: unknown, thisArg?: unknown): T | S | undefined {
    throw new Error("Method not implemented.");
  }
  findIndex(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): number {
    throw new Error("Method not implemented.");
  }
  fill(value: T, start?: number | undefined, end?: number | undefined): this {
    throw new Error("Method not implemented.");
  }
  copyWithin(target: number, start: number, end?: number | undefined): this {
    throw new Error("Method not implemented.");
  }
  entries(): IterableIterator<[number, T]> {
    throw new Error("Method not implemented.");
  }
  keys(): IterableIterator<number> {
    throw new Error("Method not implemented.");
  }
  values(): IterableIterator<T> {
    throw new Error("Method not implemented.");
  }
  includes(searchElement: T, fromIndex?: number | undefined): boolean {
    throw new Error("Method not implemented.");
  }
  flatMap<U, This = undefined>(callback: (this: This, value: T, index: number, array: T[]) => U | readonly U[], thisArg?: This | undefined): U[] {
    throw new Error("Method not implemented.");
  }
  flat<A, D extends number = 1>(this: A, depth?: D | undefined): FlatArray<A, D>[] {
    throw new Error("Method not implemented.");
  }
  at(index: number): T | undefined {
    throw new Error("Method not implemented.");
  }
  [Symbol.iterator](): IterableIterator<T> {
    throw new Error("Method not implemented.");
  }
  [Symbol.unscopables](): { copyWithin: boolean; entries: boolean; fill: boolean; find: boolean; findIndex: boolean; keys: boolean; values: boolean; } {
    throw new Error("Method not implemented.");
  }

}