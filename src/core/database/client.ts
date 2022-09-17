import { inspect } from "util";
import { Database } from "."; 
import { WObject } from "../gen/sync";
import { Schema, WarpObject } from "../schema";

export function createClient(schema: Schema, url: string) {
  return new Database(mutation => {
    printMutation(schema, mutation);
  });
}

function printMutation(schema: Schema, mutation: WObject) {
  const type = schema.root.lookupType(mutation.type!);
  const state = mutation.state && type.decode(mutation.state);

  console.log(inspect({
    ...mutation,
    state,
  }, false, null, true));
}