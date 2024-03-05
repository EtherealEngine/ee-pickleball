import { UserID } from '@etherealengine/common/src/schema.type.module'
import { isClient } from '@etherealengine/common/src/utils/getEnvironment'
import {
  EntityUUID,
  UndefinedEntity,
  defineComponent,
  getComponent,
  hasComponent,
  useEntityContext
} from '@etherealengine/ecs'
import { AvatarComponent } from '@etherealengine/engine/src/avatar/components/AvatarComponent'
import { dispatchAction, getState } from '@etherealengine/hyperflux'
import { UUIDComponent } from '@etherealengine/ecs'
import { setCallback } from '@etherealengine/spatial/src/common/CallbackComponent'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { traverseEntityNodeParent } from '@etherealengine/spatial/src/transform/components/EntityTree'
import { useEffect } from 'react'
import { PickleballComponent } from './PickleballComponent'
import { PickleballActions, PickleballState } from './PickleballGameState'

const zoneNames = ['zone-1', 'zone-2']

export const PlayerZoneComponent = defineComponent({
  name: 'PlayerZoneComponent',
  jsonID: 'ee-pickleball.zone',

  reactor: function () {
    /** Run player enter logic only on the server */
    if (isClient) return null

    const entity = useEntityContext()

    useEffect(() => {
      let gameEntity = UndefinedEntity

      traverseEntityNodeParent(entity, (parent) => {
        if (hasComponent(parent, PickleballComponent)) {
          gameEntity = parent
        }
      })

      if (!gameEntity) throw new Error('PlayerZoneComponent must be a child of a PickleballComponent')

      const gameEntityUUID = getComponent(gameEntity, UUIDComponent) as EntityUUID

      const index = zoneNames.indexOf(getComponent(entity, NameComponent))

      /** Set callbacks to dispatch join/leave events */
      setCallback(entity, 'playerJoin', (triggerEntity, otherEntity) => {
        if (!hasComponent(otherEntity, AvatarComponent)) return
        const playerUserID = getComponent(otherEntity, UUIDComponent) as any as UserID

        /** Dispatch a player change event with this player */
        dispatchAction(
          PickleballActions.playerChange({
            gameEntityUUID,
            playerIndex: index,
            playerUserID: playerUserID
          })
        )
      })

      setCallback(entity, 'playerLeave', (triggerEntity, otherEntity) => {
        if (!hasComponent(otherEntity, AvatarComponent)) return
        const connected = getState(PickleballState)[gameEntityUUID].players[index].connected
        /** Check if the currently connected player is not this player */
        if (connected !== (getComponent(otherEntity, UUIDComponent) as any as UserID)) return

        /** Dispatch a player change event with no player */
        dispatchAction(
          PickleballActions.playerChange({
            gameEntityUUID,
            playerIndex: index
          })
        )
      })
    }, [])

    return null
  }
})
