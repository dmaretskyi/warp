import { Task, TaskList, schema } from "./gen/warp-example-task_list"
import expect from 'expect'
import { Database } from "../core/database"
import { createClient } from "../core/database/client"
import { bindReplicationSockets } from "../core/database/utils"

it.only('replication', () => {
  const server = new Database(schema)
  const client = new Database(schema)
  bindReplicationSockets(server.replicate(), client.replicate(), schema)
  
  const taskList = new TaskList()
  client.import(taskList)

  taskList.tasks.push(new Task({ title: 'Buy milk' }))
  taskList.tasks.push(new Task({ title: 'Buy eggs' }))

  expect(taskList.tasks.length).toBe(2)
  expect(taskList.tasks[0].title).toBe('Buy milk')
  expect(taskList.tasks[1].title).toBe('Buy eggs')
})