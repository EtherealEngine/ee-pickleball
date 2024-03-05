import multiLogger from '@etherealengine/common/src/logger'
import { UserID } from '@etherealengine/common/src/schema.type.module'
import { EntityUUID, matchesEntityUUID } from '@etherealengine/ecs'
import { Engine } from '@etherealengine/ecs/src/Engine'
import { SceneState } from '@etherealengine/engine/src/scene/Scene'
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
import React, { useEffect } from 'react'
import { PaddleActions } from './PaddleState'
import './PickleballComponent'
import { spawnBall } from './PickleballPhysicsSystem'
import { SpawnObjectActions } from '@etherealengine/spatial/src/transform/SpawnObjectActions'

const logger = multiLogger.child({ component: 'PickleballSystem' })

export class PickleballActions {
  static startGame = defineAction({
    type: 'ee-pickleball.START_GAME',
    gameEntityUUID: matchesEntityUUID,
    $topic: NetworkTopics.world
  })

  static endGame = defineAction({
    type: 'ee-pickleball.END_GAME',
    gameEntityUUID: matchesEntityUUID,
    $topic: NetworkTopics.world
  })

  static playerChange = defineAction({
    type: 'ee-pickleball.PLAYER_CONNECTED',
    gameEntityUUID: matchesEntityUUID,
    playerIndex: matches.number,
    playerUserID: matchesUserId.optional(),
    $topic: NetworkTopics.world
  })

  static playerScore = defineAction({
    type: 'ee-pickleball.PLAYER_SCORE',
    gameEntityUUID: matchesEntityUUID,
    playerIndex: matches.number,
    $topic: NetworkTopics.world
  })

  static spawnBall = defineAction({
    ...SpawnObjectActions.spawnObject.actionShape,
    prefab: 'ee-pickleball.ball',
    gameEntityUUID: matchesEntityUUID,
    $topic: NetworkTopics.world
  })
}

export const PickleballState = defineState({
  name: 'ee-pickleball.PickleballState',
  initial: {} as Record<
    EntityUUID,
    {
      players: Array<{
        score: number
        connected: UserID | null
      }>
      ball: EntityUUID | null
      ballCooldown: number
    }
  >,

  receptors: {
    onStartGame: PickleballActions.startGame.receive((action) => {
      const state = getMutableState(PickleballState)
      state[action.gameEntityUUID].set({
        players: [
          {
            score: 0,
            connected: null
          },
          {
            score: 0,
            connected: null
          }
        ],
        ball: null,
        ballCooldown: 3000 // start in three seconds
      })
    }),
    onEndGame: PickleballActions.endGame.receive((action) => {
      const state = getMutableState(PickleballState)
      state[action.gameEntityUUID].set(none)
    }),
    onPlayerChange: PickleballActions.playerChange.receive((action) => {
      const state = getMutableState(PickleballState)
      state[action.gameEntityUUID].players[action.playerIndex].connected.set(action.playerUserID ?? null)
    }),
    onPlayerScore: PickleballActions.playerScore.receive((action) => {
      const state = getMutableState(PickleballState)
      state[action.gameEntityUUID].players[action.playerIndex].score.set((current) => current + 1)
    }),
    onSpawnBall: PickleballActions.spawnBall.receive((action) => {
      const state = getMutableState(PickleballState)
      state[action.gameEntityUUID].ball.set(action.entityUUID)
    }),
    onDestroyBall: WorldNetworkAction.destroyEntity.receive((action) => {
      const state = getMutableState(PickleballState)
      for (const gameUUID of state.keys) {
        const game = state[gameUUID as EntityUUID]
        if (game.ball.value === action.entityUUID) {
          game.ballCooldown.set(3000)
          game.ball.set(null)
          return
        }
      }
    })
  },

  reactor: () => {
    const pickleballState = useHookstate(getMutableState(PickleballState))
    const sceneLoaded = useHookstate(getMutableState(SceneState).sceneLoaded)
    if (!sceneLoaded.value) return null
    return (
      <>
        {pickleballState.keys.map((gameUUID: EntityUUID) => (
          <GameReactor key={gameUUID} gameUUID={gameUUID} />
        ))}
      </>
    )
  }
})

const PlayerReactor = (props: { playerIndex: number; gameUUID: EntityUUID }) => {
  const playerState = getMutableState(PickleballState)[props.gameUUID].players[props.playerIndex]
  const connected = useHookstate(playerState.connected)
  const score = useHookstate(playerState.score)

  useEffect(() => {
    const userID = connected.value

    if (!userID) return

    logger.info(`Player ${props.playerIndex} connected: ${userID}`)

    /** Dispatch from the client who is to wield the paddles */
    if (userID !== Engine.instance.userID)
      return () => {
        logger.info(`Player ${props.playerIndex} disconnected`)
      }

    dispatchAction(
      PaddleActions.spawnPaddle({
        entityUUID: (userID + '_paddle_left') as EntityUUID,
        gameEntityUUID: props.gameUUID,
        handedness: 'left',
        owner: userID
      })
    )
    dispatchAction(
      PaddleActions.spawnPaddle({
        entityUUID: (userID + '_paddle_right') as EntityUUID,
        gameEntityUUID: props.gameUUID,
        handedness: 'right',
        owner: userID
      })
    )

    return () => {
      logger.info(`Player ${props.playerIndex} disconnected`)

      dispatchAction(
        WorldNetworkAction.destroyEntity({
          entityUUID: (userID + '_paddle_left') as EntityUUID
        })
      )
      dispatchAction(
        WorldNetworkAction.destroyEntity({
          entityUUID: (userID + '_paddle_right') as EntityUUID
        })
      )
    }
  }, [connected])

  useEffect(() => {
    logger.info(`Player ${props.playerIndex} score: ${score.value}`)
  }, [score])

  return null
}

const BallReactor = (props: { gameUUID: EntityUUID }) => {
  const ballState = useHookstate(getMutableState(PickleballState)[props.gameUUID].ball)

  useEffect(() => {
    if (!ballState.value) return
    spawnBall(props.gameUUID, ballState.value)
  }, [ballState])

  return null
}

const GameReactor = (props: { gameUUID: EntityUUID }) => {
  useEffect(() => {
    logger.info(`Game ${props.gameUUID} started`)
    return () => {
      logger.info(`Game ${props.gameUUID} ended`)
    }
  }, [])

  return (
    <>
      <PlayerReactor playerIndex={0} gameUUID={props.gameUUID} />
      <PlayerReactor playerIndex={1} gameUUID={props.gameUUID} />
      <PlayerReactor playerIndex={2} gameUUID={props.gameUUID} />
      <PlayerReactor playerIndex={3} gameUUID={props.gameUUID} />
      <BallReactor gameUUID={props.gameUUID} />
    </>
  )
}
