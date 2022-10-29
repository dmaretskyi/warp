import { useEffect, useState } from "react"
import { createClient } from "../../core/database/client"
import { onUpdate, Schema, WarpObject, WarpPrototype } from "../../core/schema"

export const useObject = (obj?: WarpObject | null) => {
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

export const useDatabase = <T extends WarpObject>(prototype: WarpPrototype<T>, params: { schema: Schema, url: string }): T | null => {
  const database = (window as any).__WARP_CLIENT ??= createClient(params.schema, params.url)

  const [root, setTaskList] = useState<T | null>(null);

  useEffect(() => {
    setTimeout(() => {
      const taskList = database.getOrCreateRoot(prototype);
      setTaskList(taskList);
    }, 200);
  })

  return root
}