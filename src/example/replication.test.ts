import { Task, TaskList, schema } from "./gen/warp-example-task_list"
import expect from 'expect'
import { Database } from "../core/database"
import { createClient } from "../core/database/client"
import { bindReplicationSockets } from "../core/database/utils"

it('replication', () => {
  const server = new Database(schema)

  let serverSideTaskList: TaskList
  {
    const client = new Database(schema)
    const stop = bindReplicationSockets(server.replicate(), client.replicate(), schema)
    
    const taskList = serverSideTaskList = new TaskList()
    client.import(taskList)

    taskList.tasks.push(new Task({ title: 'Buy milk' }))
    taskList.tasks.push(new Task({ title: 'Buy eggs' }))

    stop()
  }

  {
    const client = new Database(schema)
    const stop = bindReplicationSockets(server.replicate(), client.replicate(), schema)

    const root = client.getRootObject()!;
    const taskList = root.object as TaskList;

    expect(taskList.id).toEqual(serverSideTaskList.id)
    expect(taskList.tasks.length).toEqual(2)
    expect(taskList.tasks[0].id).toEqual(serverSideTaskList.tasks[0].id)
    expect(taskList.tasks[0].title).toEqual('Buy milk')
    expect(taskList.tasks[1].id).toEqual(serverSideTaskList.tasks[1].id)
    expect(taskList.tasks[1].title).toEqual('Buy eggs')

    stop()
  }
})