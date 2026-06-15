
import { AppState, Action, FavListAction } from "../Types"
import { Config } from '../Config';

import { setConfig, setFavList} from '../LocalStorage';
import { StateFactory } from "./StateFactory";
import { arrayEqual } from "../Math";
import { getInitialState } from "./InitialState";
// NOTE(port): removed `import ReactGA from 'react-ga'` (analytics) and its pageview call.

export { getInitialState }
function reduceByFavlist(state: AppState, action: FavListAction) {
    let favList = state.favList;

    switch (action.action) {
        case "add":
            favList = [...action.content, ...favList]
            setFavList(favList)
            break;
        case "remove": {
        // only remove one at a time for now
            const rem = action.content[0]
            favList = favList.filter((value) => {
                return !(value.mode === rem.mode && value.setup === rem.setup && arrayEqual(value.solver, rem.solver))
            })
            setFavList(favList)
            break;
        };
        case "replay": {
            return StateFactory.create(state).onReplay(action.content[0])
        }
    }
    return {
        ...state,
        favList
    }
}

export function reducer(state: AppState, action: Action): AppState {
    // todo: cache values based on this
    // console.log("prev state", state)
    switch (action.type) {
        case "key": {
            let newState = reduceByKey(state, action.content)
            return newState
        };
        case "config": {
            // LESSON: Object.assign is dangerous
            let newConfig = {...state.config, ...action.content}

            // enforce constraints across selectors
            //if (newConfig.fbPairSolvedSelector.flags[1] === 1) {
            //    newConfig.fbdrSelector.flags = [1, 0, 0]
            //}
            setConfig(newConfig)
            let newState = reduceByConfig(state, newConfig)
            return {
                ...newState,
                config: newConfig
            }
        };
        case "mode": {
            let mode = action.content
            // NOTE(port): dropped ReactGA.pageview(mode) analytics call.
            // NOTE(port): removed `window.location.hash = mode` — nuqs (?m=) now
            // owns the URL for the mode; the shell dispatches mode + sets the query.

            state = getInitialState(mode)
            return state
        };
        case "scrambleInput":
            return {
                ...state,
                scrambleInput: action.content
            }
        case "favList":
            return reduceByFavlist(state, action)
        case "colorScheme":
            return {
                ...state,
                colorScheme: state.colorScheme.set(action.content)
            }
        case "custom":
            return action.content(state)
        default:
            return state
        }
}


function reduceByKey(state: AppState, code: string): AppState {
    if (code === "") return state;

    const stateM = StateFactory.create(state)
    // case match on kind of operation
    if (code[0] === "#") {
        return stateM.onControl(code)
    } else {
        return stateM.onMove(code)
    }
}
function reduceByConfig(state: AppState, conf: Config): AppState {
    const stateM = StateFactory.create(state)
    // case match on kind of operation
    return stateM.onConfig(conf)
}