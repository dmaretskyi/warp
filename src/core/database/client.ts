import { Database } from "."; 
import { WarpObject } from "../schema";

export function createClient(url: string) {
  return new Database(mutation => {
    console.log(mutation);
  });
}