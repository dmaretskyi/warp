import { generateObjectPrototype, Schema, WarpList } from "../../core/schema";
import { schemaJson } from './schema'

export const schema = Schema.fromJson(schemaJson);

export class TaskList extends generateObjectPrototype(schema, 'warp.example.task_list.TaskList') {
  constructor(opts?: { tasks?: Array<Task> }) {
    super(opts);
  }
  
  declare readonly id: string;
  declare tasks: WarpList<Task>;
}
schema.registerPrototype(TaskList);

export class Task extends generateObjectPrototype(schema, 'warp.example.task_list.Task') {
  constructor(opts?: { title?: string, count?: number, completed?: boolean }) {
    super(opts);
  }

  declare readonly id: string;
  declare title: string;
  declare count: number;
  declare completed: boolean;
}
schema.registerPrototype(Task);

export class Person extends generateObjectPrototype(schema, 'warp.example.task_list.Person') {
  constructor(opts?: { name?: string }) {
    super(opts);
  }

  declare readonly id: string;
  declare name: string;
  declare contact?: Contact;
}
schema.registerPrototype(Person);

export class Contact extends generateObjectPrototype(schema, 'warp.example.task_list.Contact') {
  constructor(opts?: { name?: string }) {
    super(opts);
  }

  declare readonly id: string;
  declare email: string;
}
schema.registerPrototype(Contact);
