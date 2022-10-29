import { schema, Task, TaskList } from "../gen/warp-example-task_list";
import { useDatabase, useObject } from "./common";

export const App = () => {
  const taskList = useDatabase(TaskList, { schema, url: 'ws://localhost:1122' })

  useObject(taskList)

  const addTask = () => {
    taskList?.tasks.push(new Task({ title: 'New task' }));
  };

  const editTaskTitle = (task: Task, newTitle: string) => {
    task.title = newTitle;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      <div style={{ flex: 1 }}>
        <div>
          {taskList && taskList.tasks.map(task => (
            <div key={task.id}>
              <input type="checkbox" checked={task.completed} onChange={e => task.completed = e.target.checked} />
              <input type="text" value={task.title} onChange={e => editTaskTitle(task, e.currentTarget.value)} />
            </div>
          ))}
        </div>
        <button onClick={addTask}>
          Add Task
        </button>
      </div>
    </div>
  )
}

