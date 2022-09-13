import * as pb from 'protobufjs'

export class Schema {
  static fromJson(json: string) {
    return new Schema(pb.Root.fromJSON(JSON.parse(json)))
  }

  constructor(
    public readonly root: pb.Root,
  ) {}
}