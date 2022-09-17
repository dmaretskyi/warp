import { Task, TaskList, schema } from "./gen/warp-example-task_list"
import expect from 'expect'
import { Database } from "../core/database"
import { debugReplication } from "../core/database/utils"
import { WObject } from "../core/gen/sync"

it('data dsl', () => {
  const database = new Database(schema)
  debugReplication(database.replicate(), schema)

  const taskList = new TaskList()
  database.import(taskList)

  taskList.tasks.push(new Task({ title: 'Buy milk' }))
  taskList.tasks.push(new Task({ title: 'Buy eggs' }))

  expect(taskList.tasks.length).toBe(2)
  expect(taskList.tasks[0].title).toBe('Buy milk')
  expect(taskList.tasks[1].title).toBe('Buy eggs')
})

const createMutation = ({ id, type, parent, state }: { id: string, type: string, parent?: string, state: any }) => {
  const stateEncoded = schema.root.lookupType(type)!.encode(state).finish();
  return WObject.create({
    id,
    type,
    parent,
    state: stateEncoded,
  })
}

it('incoming mutations', () => {
  const database = new Database(schema)

  database.externalMutation(createMutation({
    id: '600fa93e-0609-41ee-b391-41a69661ed05',
    type: 'warp.example.task_list.TaskList',
    state: {
      tasks: [
        { id: 'bdd1262f-0def-4d31-a144-0742189c0724' },
        { id: '9cf9c2c9-f281-4174-a6bb-005656f463d5' }
      ]
    },
  }))
  database.externalMutation(createMutation({
    id: 'bdd1262f-0def-4d31-a144-0742189c0724',
    type: 'warp.example.task_list.Task',
    state: { title: 'Buy milk' },
    parent: '600fa93e-0609-41ee-b391-41a69661ed05'
  }))
  database.externalMutation(createMutation({
    id: '9cf9c2c9-f281-4174-a6bb-005656f463d5',
    type: 'warp.example.task_list.Task',
    state: { title: 'Buy eggs' },
    parent: '600fa93e-0609-41ee-b391-41a69661ed05'
  }))


  const root = database.getRootObject()!;
  const taskList = root.object as TaskList;
  expect(taskList.id).toEqual('600fa93e-0609-41ee-b391-41a69661ed05')
  expect(taskList.tasks.length).toBe(2)
  expect(taskList.tasks[0].id).toEqual('bdd1262f-0def-4d31-a144-0742189c0724')
  expect(taskList.tasks[0].title).toEqual('Buy milk')
  expect(taskList.tasks[1].id).toEqual('9cf9c2c9-f281-4174-a6bb-005656f463d5')
  expect(taskList.tasks[1].title).toEqual('Buy eggs')
})