import { kWarpInner, WarpObject } from "../schema";

export class Database {
  constructor(
    private readonly onMutation: (mutation: string) => void,
  ) {}

  private objects = new Map<string, WarpObject>();

  import(object: WarpObject) {
    object[kWarpInner].database = this;

    this.objects.set(object[kWarpInner].id, object);
    object[kWarpInner].flush()
  }

  mutate(mutation: string) {
    this.onMutation(mutation);
  }
}