import assert from 'assert';
import * as pb from 'protobufjs'
import { WarpObject, WarpPrototype } from './dsl'

export class Schema {
  public prototypes = new Map<string, WarpPrototype>();

  static fromJson(json: string) {
    return new Schema(pb.Root.fromJSON(JSON.parse(json)))
  }

  constructor(
    public readonly root: pb.Root,
  ) {}

  registerPrototype(prototype: WarpPrototype) {
    assert(!this.prototypes.has(prototype.typeName), `Duplicate type ${prototype.typeName}`);
    this.prototypes.set(prototype.typeName, prototype);
  }
}