import { generateObjectPrototype, Schema, WarpList } from "../../core/schema";
import { schemaJson } from './schema'

const schema = Schema.fromJson(schemaJson);

export class TaskList extends generateObjectPrototype(schema, 'warp.example.task_list.TaskList') {
  declare tasks: WarpList<Task>;
}

export class Task extends generateObjectPrototype(schema, 'warp.example.task_list.Task') {
  declare readonly id: string;
  declare title: string;
}