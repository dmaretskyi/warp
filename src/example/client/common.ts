import { useEffect, useState } from "react"
import { onUpdate, WarpObject } from "../../core/schema"

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