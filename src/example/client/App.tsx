import { useEffect, useState } from "react";
import { Database } from "../../core/database";
import { createClient } from "../../core/database/client";
import { kWarpInner, onUpdate, WarpObject } from "../../core/schema";
import { schema, Task, TaskList } from "../gen/warp-example-task_list";
import { TaskListView } from "./TaskList";

const database = createClient(schema, 'ws://localhost:1122')


export const App = () => {
  const [taskList, setTaskList] = useState<TaskList | null>(null);

  useEffect(() => {
    setTimeout(() => {
      const taskList = database.getOrCreateRoot(TaskList);
      setTaskList(taskList);
    }, 200);
  })


  return (
    <div style={{ display: 'flex', flexDirection: 'row'}}>
      {taskList && <TaskListView taskList={taskList}/>}
    </div>
  );
}

export const ManualJsonView = () => {
  const getData = () => {
    // return {
    //   objects: Array.from(database.objects.values()).filter(ref => ref.getObject()).map(ref => ref.getObject()!.frontend),
    // }
    return database.getRootObject()?.frontend ?? null
  }

  const [jsonView, setJsonView] = useState(JSON.stringify(getData(), null, 2));
  
  useEffect(() => {
    setInterval(() => {
      setJsonView(JSON.stringify(getData(), null, 2))
    }, 500)
  })

  return <pre style={{ minHeight: 400, display: 'block', flex: 1 }}>{jsonView}</pre>
}