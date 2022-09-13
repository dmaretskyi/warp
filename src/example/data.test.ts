import { Task, TaskList } from "./gen/warp-example-task_list"
import expect from 'expect'
import { Database } from "../core/database"

it('data dsl', () => {
  const taskList = new TaskList()

  const database = new Database()
  database.import(taskList)

  {
    const task = new Task()
    task.title = 'Buy milk';
    taskList.tasks.push(task)
  }
  {
    const task = new Task()
    task.title = 'Buy eggs';
    taskList.tasks.push(task)
  }

  expect(taskList.tasks.length).toBe(2)
  expect(taskList.tasks[0].title).toBe('Buy milk')
  expect(taskList.tasks[1].title).toBe('Buy eggs')
})