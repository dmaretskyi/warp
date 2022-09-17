import { Schema } from "./schema";
import * as uuid from 'uuid';
import * as pb from 'protobufjs';
import { Database } from "../database";
import { WObject } from "../gen/sync";
import { assert } from "console";

export function generateObjectPrototype(schema: Schema, name: string): new (opts?: Record<string, unknown>) => WarpObject {
  const type = schema.root.lookupType(name);

  if(!type.fields['id']) {
    throw new Error(`Type ${name} does not have an id field`);
  }

  const klass = class extends WarpObject {
    constructor(opts?: Record<string, unknown>) {
      super();
      this[kWarpInner] = new WarpInner(type);
      this[kWarpInner].object = this;
      if(opts) {
        this[kWarpInner].setMany(opts);
      }
    }
  }

  for(const field of type.fieldsArray) {
    field.resolve();
    if(field.repeated) {
      Object.defineProperty(klass.prototype, field.name, {
        get(this: WarpObject) {
          const defaultValue = new WarpList()
          defaultValue.owner = this;
          return this[kWarpInner].get(field.name, defaultValue)
        },
        set(this: WarpObject, value: unknown) {
          const list = value instanceof WarpList ? value : new WarpList(...value as any);
          list.owner = this;
          list.flush();

          this[kWarpInner].set(field.name, value);
        },
      })  
    } else if(field.resolvedType instanceof pb.Type) {
      Object.defineProperty(klass.prototype, field.name, {
        get(this: WarpObject) {
          return this[kWarpInner].getRef(field.name)
        },
        set(this: WarpObject, value: WarpObject) {
          this[kWarpInner].setRef(field.name, value);
        },
      })
    } else if(field.name === 'id') {
      Object.defineProperty(klass.prototype, field.name, {
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
          this[kWarpInner].set(field.name, value);
        },
      }) 
    }
  }

  return klass;
}

export const kWarpInner = Symbol('WarpInner');


export class WarpObject {
  protected [kWarpInner]!: WarpInner;

  readonly id!: string;

  constructor() {}
}

export class WarpInner {
  
  public id: string = uuid.v4();
  public object?: WarpObject;
  public database?: Database;
  public parent?: WarpObject;

  private data: Record<string, any> = {}

  private linked = new Map<string, WarpObject>();

  constructor(
    public type: pb.Type,
  ) {}

  get typeName() {
    return this.type.fullName.slice(1);
  }

  public get(name: string, defaultValue?: unknown): unknown {
    return this.data[name] ??= defaultValue;
  }

  public set(name: string, value: unknown): void {
    this.data[name] = value;
    this.database?.mutate(this.serialize());
  }

  public setMany(opts: Record<string, unknown>) {
    for(const [key, value] of Object.entries(opts)) {
      if(value instanceof WarpObject) {
        this.setRef(key, value);
      } else if(value instanceof WarpList || Array.isArray(value)) {
        const list = new WarpList(...value)
        list.owner = this.object;
        this.set(key, list);
      } else {
        this.set(key, value);
      }
    }
  }

  public getRef(name: string): WarpObject | undefined {
    return this.data[name] ? this.linked.get(this.data[name])! : undefined;
  }

  public setRef(name: string, value: WarpObject): void {
    this.link(value);

    const prev = this.getRef(name);
    if(prev) {
      prev[kWarpInner].unlink(prev);
    }

    this.set(name, { id: value.id });
  }

  public link(obj: WarpObject) {
    assert(obj[kWarpInner].parent === undefined, 'Object already has a parent');

    this.linked.set(obj.id, obj);
    obj[kWarpInner].parent = this.object;

    this.database?.import(obj);
  }

  public unlink(obj: WarpObject) {
    assert(obj[kWarpInner].parent === this.object, 'Object is not a child of this object');

    this.linked.delete(obj.id);
    obj[kWarpInner].parent = undefined;
  }

  serialize(): WObject {
    return WObject.create({
      id: this.id,
      type: this.typeName,
      version: 0,
      parent: this.parent?.id,
      state: this.type.encode(prepareData(this.data)).finish(),
    })
  }

  flush() {
    this.database?.mutate(this.serialize());
  }

  externalMutation(obj: WObject) {
    assert(obj.id === this.id, 'Object id mismatch');
    assert(obj.type === this.typeName, 'Object type mismatch');

    this.data = prepareDataReverse(this.type.toObject(this.type.decode(obj.state)));
  }
}

function prepareData(data: any): any {
  if(typeof data === 'object' && data !== null) {
    const res: Record<string, any> = {};
    for(const [key, value] of Object.entries(data)) {
      if(value instanceof WarpObject) {
        res[key] = { id: value.id };
      } else if(value instanceof WarpList) {
        res[key] = value.serialize();
      } else {
        res[key] = prepareData(value);
      }
    }
    return res
  } else {
    return data
  }
}

function prepareDataReverse(data: any): any {
  if(typeof data === 'object' && data !== null) {
    const res: Record<string, any> = {};
    for(const [key, value] of Object.entries(data)) {
       if(Array.isArray(value)) {
        res[key] = new WarpList(...value.map(prepareDataReverse));
      } else {
        res[key] = prepareDataReverse(value);
      }
    }
    return res
  } else {
    return data
  }
}

export class WarpList<T> implements Array<T> {
  public database?: Database;
  public owner?: WarpObject;

  private readonly data: T[];

  constructor(...items: T[]) {
    this.data = [...items];

    return new Proxy(this, {
      get: (target, key) => {
        if(typeof key === 'string' && key.match(/^\d+$/)) {
          return this.data[parseInt(key)]
        }

        return Reflect.get(target, key);
      },
      set: (target, key, value) => {
        if(typeof key === 'string' && key.match(/^\d+$/)) {
          this.data[parseInt(key)] = value;
        }

        if(value instanceof WarpObject) {
          this.owner?.[kWarpInner].link(value);
        }
        this.owner?.[kWarpInner].flush();

        return Reflect.set(target, key, value);
      },
    })
  }

  flush() {
    for(const item of this.data) {
      if(item instanceof WarpObject) {
        this.owner?.[kWarpInner].link(item);
      }
    }
  }

  serialize(): Record<string, any>[] {
    return this.data.map(item => {
      if(item instanceof WarpObject) {
        return { id: item.id };
      }
      return prepareData(item);
    });
  }

  [n: number]: T 

  get length(): number {
    return this.data.length;
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
    const res = this.data.push(...items);
    for(const obj of items) {
      if(obj instanceof WarpObject) {
        this.owner?.[kWarpInner].link(obj);
      }
    }
    this.owner?.[kWarpInner].flush();
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
    throw new Error("Method not implemented.");
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