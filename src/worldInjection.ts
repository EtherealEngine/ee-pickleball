import './PaddleState'
import './PickleballGameState'
import './PickleballPhysicsSystem'
import './PickleballComponent'
import './PlayerZoneComponent'
import { isClient } from '@etherealengine/common/src/utils/getEnvironment'

if (isClient) {
  import('./RegisterStudioComponents')
}