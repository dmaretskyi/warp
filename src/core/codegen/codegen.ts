import * as pb from "protobufjs";
import * as ts from "typescript";

const f = ts.factory;

export function codegenSchema(
  schema: pb.Root
) {
  return `export const schemaJson = ${JSON.stringify(JSON.stringify(schema.toJSON()))}`;
}

export function *iterTypes(ns: pb.NamespaceBase): IterableIterator<pb.Type> {
  for(const type of ns.nestedArray) {
    if(type instanceof pb.Type) {
      yield type;
    } 
    
    if(type instanceof pb.NamespaceBase) {
      yield* iterTypes(type);
    }
  }
}
