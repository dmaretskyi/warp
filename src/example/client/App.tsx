import { useEffect, useState } from "react";
import { createClient } from "../../core/database/client";
import { schema, Task, TaskList } from "../gen/warp-example-task_list";

const database = createClient(schema, 'ws://localhost:1122');

export const App = () => {
  const [taskList, setTaskList] = useState<TaskList | null>(null);

  useEffect(() => {
    setTimeout(() => {
      if(database.getRootObject()?.object) {
        setTaskList(database.getRootObject()?.object as TaskList);
      } else {
        const taskList = new TaskList()
        database.import(taskList);
        setTaskList(taskList);
      }
    }, 200);
  })

  return (
    <div>
      <pre>{JSON.stringify(taskList)}</pre>
      <button onClick={() => { taskList?.tasks.push(new Task({ title: 'New task' })) }}>Add Task</button>
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