import { generateObjectPrototype, Schema, WarpList } from "../../core/schema";
import { schemaJson } from './schema'

export const schema = Schema.fromJson(schemaJson);

export class TaskList extends generateObjectPrototype(schema, 'warp.example.task_list.TaskList') {
  constructor(opts?: { tasks?: Array<Task> }) {
    super(opts);
  }
  
  declare tasks: WarpList<Task>;
}

export class Task extends generateObjectPrototype(schema, 'warp.example.task_list.Task') {
  constructor(opts?: { title?: string }) {
    super(opts);
  }

  declare readonly id: string;
  declare title: string;
}