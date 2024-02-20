import { ComponentShelfCategoriesState } from '@etherealengine/editor/src/components/element/ElementList'
import { getMutableState } from '@etherealengine/hyperflux'
import { PickleballComponent } from './PickleballComponent'
import { PlayerZoneComponent } from './PlayerZoneComponent'

getMutableState(ComponentShelfCategoriesState).Misc.merge([PickleballComponent, PlayerZoneComponent])
