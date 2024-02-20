import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat'
import { EntityUUID } from '@etherealengine/common/src/interfaces/EntityUUID'
import { getMutableState, getState } from '@etherealengine/hyperflux'
import { PhysicsSystem } from '@etherealengine/spatial/src/physics/PhysicsModule'

import { isClient } from '@etherealengine/common/src/utils/getEnvironment'
import { defineSystem, getComponent, setComponent } from '@etherealengine/ecs'
import { PrimitiveGeometryComponent } from '@etherealengine/engine/src/scene/components/PrimitiveGeometryComponent'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { UUIDComponent } from '@etherealengine/spatial/src/common/UUIDComponent'
import { Physics } from '@etherealengine/spatial/src/physics/classes/Physics'
import { RigidBodyComponent } from '@etherealengine/spatial/src/physics/components/RigidBodyComponent'
import { CollisionGroups, DefaultCollisionMask } from '@etherealengine/spatial/src/physics/enums/CollisionGroups'
import { getInteractionGroups } from '@etherealengine/spatial/src/physics/functions/getInteractionGroups'
import { PhysicsState } from '@etherealengine/spatial/src/physics/state/PhysicsState'
import { VisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'
import {
  DistanceFromCameraComponent,
  FrustumCullCameraComponent
} from '@etherealengine/spatial/src/transform/components/DistanceComponents'
import { TransformComponent } from '@etherealengine/spatial/src/transform/components/TransformComponent'
import { computeTransformMatrix } from '@etherealengine/spatial/src/transform/systems/TransformSystem'
import { Quaternion, Vector3 } from 'three'
import { PickleballCollisionGroups } from './PaddleState'
import { PickleballState } from './PickleballGameState'

const ballVelocity = 0.025

export const spawnBall = (gameUUID: EntityUUID, entityUUID: EntityUUID) => {
  const entity = UUIDComponent.getEntityByUUID(entityUUID)

  const gameTransform = getComponent(UUIDComponent.getEntityByUUID(gameUUID), TransformComponent)

  setComponent(entity, TransformComponent, {
    position: gameTransform.position.clone().add(new Vector3(0, 2, 0)),
    rotation: new Quaternion().random(),
    scale: new Vector3(0.1, 0.1, 0.1)
  })
  computeTransformMatrix(entity)

  setComponent(entity, VisibleComponent)
  setComponent(entity, DistanceFromCameraComponent)
  setComponent(entity, FrustumCullCameraComponent)

  setComponent(entity, NameComponent, 'Pickleball Ball')

  setComponent(entity, PrimitiveGeometryComponent, {
    geometryType: 1
  })

  const rigidBodyDesc = RigidBodyDesc.dynamic()
  Physics.createRigidBody(entity, getState(PhysicsState).physicsWorld, rigidBodyDesc, [])

  const rigidBody = getComponent(entity, RigidBodyComponent)

  const interactionGroups = getInteractionGroups(
    CollisionGroups.Default,
    DefaultCollisionMask | PickleballCollisionGroups.PaddleCollisionGroup
  )
  const colliderDesc = ColliderDesc.ball(0.1)
  colliderDesc.setCollisionGroups(interactionGroups)
  colliderDesc.setRestitution(1)

  Physics.createColliderAndAttachToRigidBody(getState(PhysicsState).physicsWorld, colliderDesc, rigidBody.body)

  if (isClient) return

  /** create a direction along one of the cardinal directions, for the players that are connected */
  const game = getState(PickleballState)[gameUUID]
  const players = game.players.map((player, i) => (player.connected ? i : undefined))
  if (players.length === 0) return

  const player = players.reduce((acc, cur) => cur ?? acc, 0)

  const direction = new Vector3()
  if (player === 0) direction.set(0, 0, 1)
  if (player === 1) direction.set(0, 0, -1)
  if (player === 2) direction.set(1, 0, 0)
  if (player === 3) direction.set(-1, 0, 0)

  rigidBody.body.applyImpulse(direction.multiplyScalar(ballVelocity), true)

  delete TransformComponent.dirtyTransforms[entity]
}

const gameLogic = (gameUUID: EntityUUID) => {
  const game = getMutableState(PickleballState)[gameUUID]

  if (!game.value) return

  if (!game.players.find((player) => player.connected.value)) return
}

const execute = () => {
  /** game logic only needs to run in server */
  if (isClient) return

  for (const game of Object.keys(getState(PickleballState))) gameLogic(game as EntityUUID)
}

export const PickleballPhysicsSystem = defineSystem({
  uuid: 'ee-pickleball.physics.system',
  execute,
  insert: { after: PhysicsSystem }
})
