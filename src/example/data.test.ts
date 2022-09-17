import { Task, TaskList } from "./gen/warp-example-task_list"
import expect from 'expect'
import { Database } from "../core/database"
import { createClient } from "../core/database/client"

it('data dsl', () => {
  const taskList = new TaskList()

  const database = createClient('')
  database.import(taskList)

  taskList.tasks.push(new Task({ title: 'Buy milk' }))
  taskList.tasks.push(new Task({ title: 'Buy eggs' }))

  expect(taskList.tasks.length).toBe(2)
  expect(taskList.tasks[0].title).toBe('Buy milk')
  expect(taskList.tasks[1].title).toBe('Buy eggs')
})