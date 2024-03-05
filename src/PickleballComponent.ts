import { defineComponent, getComponent, useEntityContext } from '@etherealengine/ecs'
import { dispatchAction, getState } from '@etherealengine/hyperflux'
import { UUIDComponent } from '@etherealengine/network'
import { EngineState } from '@etherealengine/spatial/src/EngineState'
import { useEffect } from 'react'
import { PickleballActions } from './PickleballGameState'

export const PickleballComponent = defineComponent({
  name: 'PickleballComponent',

  jsonID: 'ee-pickleball.game',

  reactor: () => {
    const entity = useEntityContext()

    useEffect(() => {
      if (getState(EngineState).isEditing) return

      const uuid = getComponent(entity, UUIDComponent)
      dispatchAction(PickleballActions.startGame({ gameEntityUUID: uuid }))
      return () => {
        dispatchAction(PickleballActions.endGame({ gameEntityUUID: uuid }))
      }
    }, [])

    return null
  }
})
