import { Task, TaskList, schema } from "./gen/warp-example-task_list"
import expect from 'expect'
import { Database } from "../core/database"
import { createClient } from "../core/database/client"
import { bindReplicationSockets, formatMutation } from "../core/database/utils"
import { WObject } from "../core/gen/sync"

describe('replication', () => {
  it('client to server', () => {
    const server = new Database(schema)

    const client = new Database(schema)
    bindReplicationSockets(server.replicate(), client.replicate(), (direction, message) => {
      // console.log(direction + ' ', formatMutation(schema, WObject.fromBinary(message)));
    })

    const taskList = new TaskList()
    client.import(taskList)

    taskList.tasks.push(new Task({ title: 'Buy milk' }))
    taskList.tasks.push(new Task({ title: 'Buy eggs' }))

    const root = server.getRootObject()!;
    const serverSideTaskList = root.object as TaskList;

    expect(serverSideTaskList.id).toEqual(taskList.id)
    expect(serverSideTaskList.tasks.length).toEqual(2)
    expect(serverSideTaskList.tasks[0].id).toEqual(taskList.tasks[0].id)
    expect(serverSideTaskList.tasks[0].title).toEqual('Buy milk')
    expect(serverSideTaskList.tasks[1].id).toEqual(taskList.tasks[1].id)
    expect(serverSideTaskList.tasks[1].title).toEqual('Buy eggs')
  })

  it('client to server to client', () => {
    const server = new Database(schema)

    let serverSideTaskList: TaskList
    {
      const client = new Database(schema)
      const stop = bindReplicationSockets(server.replicate(), client.replicate(), (direction, message) => {
        // console.log(direction + ' ', formatMutation(schema, WObject.fromBinary(message)));
      })

      const taskList = serverSideTaskList = new TaskList()
      client.import(taskList)

      taskList.tasks.push(new Task({ title: 'Buy milk' }))
      taskList.tasks.push(new Task({ title: 'Buy eggs' }))

      stop()
    }

    {
      const client = new Database(schema)
      const stop = bindReplicationSockets(server.replicate(), client.replicate(), (direction, message) => {
        // console.log(direction + ' ', formatMutation(schema, WObject.fromBinary(message)));
      })

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
})
