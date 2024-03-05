import { UserID } from '@etherealengine/common/src/schema.type.module'
import { EntityUUID, UUIDComponent, getComponent, matchesEntityUUID, setComponent } from '@etherealengine/ecs'
import {
  GrabbableComponent,
  GrabbedComponent
} from '@etherealengine/engine/src/interaction/components/GrabbableComponent'
import { GrabbableNetworkAction } from '@etherealengine/engine/src/interaction/systems/GrabbableSystem'
import { PrimitiveGeometryComponent } from '@etherealengine/engine/src/scene/components/PrimitiveGeometryComponent'
import {
  defineAction,
  defineState,
  dispatchAction,
  getMutableState,
  matches,
  matchesUserId,
  none,
  useHookstate
} from '@etherealengine/hyperflux'
import { NetworkTopics, WorldNetworkAction } from '@etherealengine/network'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { ColliderComponent } from '@etherealengine/spatial/src/physics/components/ColliderComponent'
import { RigidBodyComponent } from '@etherealengine/spatial/src/physics/components/RigidBodyComponent'
import { CollisionGroups } from '@etherealengine/spatial/src/physics/enums/CollisionGroups'
import { BodyTypes } from '@etherealengine/spatial/src/physics/types/PhysicsTypes'
import { VisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'
import { SpawnObjectActions } from '@etherealengine/spatial/src/transform/SpawnObjectActions'
import {
  DistanceFromCameraComponent,
  FrustumCullCameraComponent
} from '@etherealengine/spatial/src/transform/components/DistanceComponents'
import { TransformComponent } from '@etherealengine/spatial/src/transform/components/TransformComponent'
import React, { useEffect } from 'react'
import { Vector3 } from 'three'

export enum PickleballCollisionGroups {
  PaddleCollisionGroup = 1 << 6
}

export class PaddleActions {
  static spawnPaddle = defineAction({
    ...SpawnObjectActions.spawnObject.actionShape,
    prefab: 'ee-pickleball.paddle',
    gameEntityUUID: matchesEntityUUID,
    handedness: matches.literals('left', 'right'),
    owner: matchesUserId,
    $topic: NetworkTopics.world
  })
}

export const PaddleState = defineState({
  name: 'ee-pickleball.PaddleState',
  initial: {} as Record<
    EntityUUID,
    {
      owner: UserID
      handedness: 'left' | 'right'
      gameEntityUUID: EntityUUID
    }
  >,

  receptors: {
    onSpawnPaddle: PaddleActions.spawnPaddle.receive((action) => {
      const state = getMutableState(PaddleState)
      state[action.entityUUID].merge({
        owner: action.owner,
        handedness: action.handedness,
        gameEntityUUID: action.gameEntityUUID
      })
    }),
    onDestroyPaddle: WorldNetworkAction.destroyEntity.receive((action) => {
      const state = getMutableState(PaddleState)
      state[action.entityUUID].set(none)
    })
  },

  reactor: () => {
    const paddlesState = useHookstate(getMutableState(PaddleState))

    return (
      <>
        {paddlesState.keys.map((entityUUID: EntityUUID) => (
          <PaddleReactor key={entityUUID} entityUUID={entityUUID} />
        ))}
      </>
    )
  }
})

const PaddleReactor = ({ entityUUID }: { entityUUID: EntityUUID }) => {
  const paddleState = useHookstate(getMutableState(PaddleState)[entityUUID])

  useEffect(() => {
    const entity = UUIDComponent.getEntityByUUID(entityUUID)
    const ownerEntity = UUIDComponent.getEntityByUUID(paddleState.owner.value as any as EntityUUID)

    /** @todo - add colours */
    // const game = getState(PickleballState)[paddleState.gameEntityUUID.value]
    // const color = PlayerColors[game.players.findIndex(player => player.connected === paddleState.owner.value)]

    setComponent(entity, TransformComponent, { scale: new Vector3(0.2, 0.2, 0.1) })
    setComponent(entity, VisibleComponent)
    setComponent(entity, DistanceFromCameraComponent)
    setComponent(entity, FrustumCullCameraComponent)

    setComponent(
      entity,
      NameComponent,
      getComponent(ownerEntity, NameComponent) + "'s " + paddleState.handedness.value + ' paddle'
    )

    setComponent(entity, PrimitiveGeometryComponent, {
      geometryType: 1
    })

    /** Grabbable system handles setting collider as kinematic, so just set it to dynamic here */
    setComponent(entity, RigidBodyComponent, { type: BodyTypes.Dynamic })
    setComponent(entity, ColliderComponent, {
      shape: 'sphere',
      collisionLayer: PickleballCollisionGroups.PaddleCollisionGroup as any,
      collisionMask: CollisionGroups.Default,
      restitution: 0.5
    })

    setComponent(entity, GrabbableComponent)
    setComponent(entity, GrabbedComponent, {
      attachmentPoint: paddleState.handedness.value,
      grabberEntity: ownerEntity
    })

    dispatchAction(
      GrabbableNetworkAction.setGrabbedObject({
        entityUUID,
        grabberUserId: paddleState.owner.value as any as EntityUUID,
        grabbed: true,
        attachmentPoint: paddleState.handedness.value
      })
    )
  }, [])

  return null
}
