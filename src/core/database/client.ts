import { inspect } from "util";
import { Database } from "."; 
import { WObject } from "../gen/sync";
import { Schema, WarpObject } from "../schema";

export function createClient(schema: Schema, url: string) {
  return new Database(schema);
}

