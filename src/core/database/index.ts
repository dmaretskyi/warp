import { kWarpInner, WarpObject } from "../schema";

export class Database {
  private objects = new Map<string, WarpObject>();

  public mutations: any[] = [];

  import(object: WarpObject) {
    object[kWarpInner].database = this;

    this.objects.set(object[kWarpInner].id, object);
    object[kWarpInner].flush()
  }

  mutate(mutation: string) {
    this.mutations.push(mutation);
  }
}