import { useEffect, useState } from "react";
import { Database } from "../../core/database";
import { createClient } from "../../core/database/client";
import { kWarpInner, onUpdate, WarpObject } from "../../core/schema";
import { schema, Task, TaskList } from "../gen/warp-example-task_list";

const database = createClient(schema, 'ws://localhost:1122')

const useObject = (obj?: WarpObject | null) => {
  const [, forceUpdate] = useState({})

  useEffect(() => {
    if(obj) {
      return onUpdate(obj, () => {
        console.log('update', obj)
        forceUpdate({})
      })
    }
  }, [obj?.id])
}


export const ManualJsonView = () => {
  const getData = () => {
    return {
      objects: Array.from(database.objects.values()).filter(ref => ref.getObject()).map(ref => ref.getObject()!.frontend),
    }
  }

  const [jsonView, setJsonView] = useState(JSON.stringify(getData(), null, 2));
  
  useEffect(() => {
    setInterval(() => {
      setJsonView(JSON.stringify(getData(), null, 2))
    }, 500)
  })

  return <pre style={{ minHeight: 400 }}>{jsonView}</pre>
}

export const App = () => {
  const [taskList, setTaskList] = useState<TaskList | null>(null);

  useEffect(() => {
    setTimeout(() => {
      const taskList = database.getOrCreateRoot(TaskList);
      setTaskList(taskList);
    }, 200);
  })

  useObject(taskList)

  const addTask = () => { 
    taskList?.tasks.push(new Task({ title: 'New task' }));
    console.log(taskList);
  };

  const editTask = (task: Task, newTitle: string) => {
    task.title = newTitle;
  }

  return (
    <div>
      <ManualJsonView/>
      <button onClick={addTask}>Add Task</button>
      {taskList && <div>
        {taskList.tasks.map(task => (
          <div key={task.id}>
            {/* <input type="checkbox" checked={task.done} onChange={e => task.done = e.target.checked} /> */}
            <input type="text" value={task.title} onChange={e => editTask(task, e.currentTarget.value)} />
          </div>
        ))}  
      </div>}
    </div>
  );
}