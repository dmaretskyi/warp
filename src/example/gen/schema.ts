
import { generateObjectPrototype, Schema, WarpList } from "../../core/schema";

const schemaJson = "{\"nested\":{\"warp\":{\"nested\":{\"example\":{\"nested\":{\"task_list\":{\"nested\":{\"TaskList\":{\"options\":{\"(warp_object)\":true},\"fields\":{\"id\":{\"type\":\"string\",\"id\":1},\"tasks\":{\"rule\":\"repeated\",\"type\":\"Task\",\"id\":2}}},\"Task\":{\"options\":{\"(warp_object)\":true},\"fields\":{\"id\":{\"type\":\"string\",\"id\":1},\"title\":{\"type\":\"string\",\"id\":2},\"count\":{\"type\":\"int32\",\"id\":3},\"completed\":{\"type\":\"bool\",\"id\":4}}},\"Person\":{\"options\":{\"(warp_object)\":true},\"fields\":{\"id\":{\"type\":\"string\",\"id\":1},\"name\":{\"type\":\"string\",\"id\":2},\"contact\":{\"type\":\"Contact\",\"id\":3}}},\"Contact\":{\"options\":{\"(warp_object)\":true},\"fields\":{\"id\":{\"type\":\"string\",\"id\":1},\"email\":{\"type\":\"string\",\"id\":2}}}}}}}}}}}"
export const schema = Schema.fromJson(schemaJson);

export class TaskList extends generateObjectPrototype(schema, 'warp.example.task_list.TaskList') {
  constructor(opts?: { tasks?: WarpList<Task> }) {
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
  constructor(opts?: { name?: string, contact?: Contact }) {
    super(opts);
  }

  declare readonly id: string;
  declare name: string;
  declare contact: Contact;
}
schema.registerPrototype(Person);


export class Contact extends generateObjectPrototype(schema, 'warp.example.task_list.Contact') {
  constructor(opts?: { email?: string }) {
    super(opts);
  }

  declare readonly id: string;
  declare email: string;
}
schema.registerPrototype(Contact);

