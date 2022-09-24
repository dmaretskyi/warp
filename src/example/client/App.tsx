import { useEffect, useState } from "react";
import { Database } from "../../core/database";
import { createClient } from "../../core/database/client";
import { onUpdate, versionOf, WarpObject } from "../../core/schema";
import { schema, Task, TaskList } from "../gen/warp-example-task_list";

const database = createClient(schema, 'ws://localhost:1122')

const useObject = (obj?: WarpObject | null) => {
  const [, forceUpdate] = useState({})

  useEffect(() => {
    if(obj) {
      return onUpdate(obj, () => forceUpdate({}))
    }
  }, [obj?.id])
}

export const App = () => {
  const [taskList, setTaskList] = useState<TaskList | null>(null);

  useEffect(() => {
    setTimeout(() => {
      if(database.getRootObject()?.object) {
        setTaskList(database.getRootObject()?.object as TaskList);
      } else {
        const taskList = new TaskList()
        console.log(taskList)
        database.import(taskList);
        setTaskList(taskList);
      }
    }, 200);
  })

  useObject(taskList);

  const addTask = () => { 
    taskList?.tasks.push(new Task({ title: 'New task' }));
    console.log(taskList && versionOf(taskList));
  };
  return (
    <div>
      <pre>{JSON.stringify(taskList)}</pre>
      <button onClick={addTask}>Add Task</button>
      {taskList && <div>
        {taskList.tasks.map(task => (
          <div key={task.id}>
            {/* <input type="checkbox" checked={task.done} onChange={e => task.done = e.target.checked} /> */}
            <input type="text" value={task.title} onChange={e => task.title = e.target.value} />
          </div>
        ))}  
      </div>}
    </div>
  );
}