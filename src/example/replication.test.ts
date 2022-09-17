import { Task, TaskList, schema } from "./gen/warp-example-task_list"
import expect from 'expect'
import { Database } from "../core/database"
import { createClient } from "../core/database/client"
import { bindReplicationSockets } from "../core/database/utils"

it.only('replication', () => {
  const server = new Database(schema)


  {
    const client = new Database(schema)
    const stop = bindReplicationSockets(server.replicate(), client.replicate(), schema)
    
    const taskList = new TaskList()
    client.import(taskList)

    taskList.tasks.push(new Task({ title: 'Buy milk' }))
    taskList.tasks.push(new Task({ title: 'Buy eggs' }))

    stop()
  }

  {
    const client = new Database(schema)
    const stop = bindReplicationSockets(server.replicate(), client.replicate(), schema)
  }
})