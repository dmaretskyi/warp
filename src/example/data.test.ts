import { Task, TaskList, schema } from "./gen/warp-example-task_list"
import expect from 'expect'
import { Database } from "../core/database"
import { debugReplication } from "../core/database/utils"

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