import type { PendingSite } from '../../supabase/memorialSites'

export interface PendingPinkNode {
  tempId: string
  name: string | null
  description: string | null
  lat: number
  lng: number
}

export interface EditableMapState {
  pinkNodes: PendingPinkNode[]
  centralSite: PendingSite | null
  localSites: PendingSite[]
}

/**
 * Structural inverses for bulk clears (not emitted directly by UI; produced by invertAction).
 */
export type EditAction =
  | { kind: 'pink:add'; node: PendingPinkNode; insertIndex?: number }
  | {
      kind: 'pink:move'
      tempId: string
      from: { lat: number; lng: number }
      to: { lat: number; lng: number }
    }
  | { kind: 'pink:remove'; node: PendingPinkNode; index: number }
  | { kind: 'pink:clear'; before: PendingPinkNode[] }
  | { kind: 'pink:replaceAll'; nodes: PendingPinkNode[] }
  | { kind: 'memorial:setCentral'; site: PendingSite; previous: PendingSite | null }
  | { kind: 'memorial:removeCentral'; previous: PendingSite }
  | { kind: 'memorial:addLocal'; site: PendingSite; insertIndex?: number }
  | {
      kind: 'memorial:moveLocal'
      tempId: string
      from: { lat: number; lng: number }
      to: { lat: number; lng: number }
    }
  | { kind: 'memorial:removeLocal'; site: PendingSite; index: number }
  | {
      kind: 'memorial:clear'
      beforeCentral: PendingSite | null
      beforeLocal: PendingSite[]
    }
  | {
      kind: 'memorial:replaceAll'
      centralSite: PendingSite | null
      localSites: PendingSite[]
    }
  | {
      kind: 'pink:updateMeta'
      tempId: string
      before: { name: string | null; description: string | null }
      after: { name: string | null; description: string | null }
    }
  | {
      kind: 'memorial:updateMeta'
      scope: 'central' | 'local'
      tempId: string
      before: { name: string | null; description: string | null }
      after: { name: string | null; description: string | null }
    }

export interface EditHistory {
  undoStack: EditAction[]
  redoStack: EditAction[]
}

export const createEmptyEditHistory = (): EditHistory => ({
  undoStack: [],
  redoStack: [],
})

export const canUndo = (history: EditHistory): boolean => history.undoStack.length > 0

export const canRedo = (history: EditHistory): boolean => history.redoStack.length > 0

function findPinkIndex(nodes: PendingPinkNode[], tempId: string): number {
  return nodes.findIndex((n) => n.tempId === tempId)
}

function findLocalIndex(sites: PendingSite[], tempId: string): number {
  return sites.findIndex((s) => s.tempId === tempId)
}

function assertPinkAtIndex(nodes: PendingPinkNode[], index: number, tempId: string): void {
  const n = nodes[index]
  if (!n || n.tempId !== tempId) {
    throw new Error(`pink:remove index ${index} does not match tempId ${tempId}`)
  }
}

function assertLocalAtIndex(sites: PendingSite[], index: number, tempId: string): void {
  const s = sites[index]
  if (!s || s.tempId !== tempId) {
    throw new Error(`memorial:removeLocal index ${index} does not match tempId ${tempId}`)
  }
}

function applyForward(state: EditableMapState, action: EditAction): EditableMapState {
  switch (action.kind) {
    case 'pink:add': {
      const { node, insertIndex } = action
      if (insertIndex === undefined) {
        return { ...state, pinkNodes: [...state.pinkNodes, node] }
      }
      const next = [...state.pinkNodes]
      next.splice(insertIndex, 0, node)
      return { ...state, pinkNodes: next }
    }
    case 'pink:move': {
      const i = findPinkIndex(state.pinkNodes, action.tempId)
      if (i < 0) throw new Error(`pink:move unknown tempId ${action.tempId}`)
      const next = [...state.pinkNodes]
      next[i] = { ...next[i], lat: action.to.lat, lng: action.to.lng }
      return { ...state, pinkNodes: next }
    }
    case 'pink:remove': {
      assertPinkAtIndex(state.pinkNodes, action.index, action.node.tempId)
      const next = [...state.pinkNodes]
      next.splice(action.index, 1)
      return { ...state, pinkNodes: next }
    }
    case 'pink:clear':
      return { ...state, pinkNodes: [] }
    case 'pink:replaceAll':
      return { ...state, pinkNodes: action.nodes.map((n) => ({ ...n })) }
    case 'memorial:setCentral':
      return { ...state, centralSite: { ...action.site } }
    case 'memorial:removeCentral':
      return { ...state, centralSite: null }
    case 'memorial:addLocal': {
      const { site, insertIndex } = action
      if (insertIndex === undefined) {
        return { ...state, localSites: [...state.localSites, { ...site }] }
      }
      const next = [...state.localSites]
      next.splice(insertIndex, 0, { ...site })
      return { ...state, localSites: next }
    }
    case 'memorial:moveLocal': {
      const i = findLocalIndex(state.localSites, action.tempId)
      if (i < 0) throw new Error(`memorial:moveLocal unknown tempId ${action.tempId}`)
      const next = [...state.localSites]
      next[i] = { ...next[i], lat: action.to.lat, lng: action.to.lng }
      return { ...state, localSites: next }
    }
    case 'memorial:removeLocal': {
      assertLocalAtIndex(state.localSites, action.index, action.site.tempId)
      const next = [...state.localSites]
      next.splice(action.index, 1)
      return { ...state, localSites: next }
    }
    case 'memorial:clear':
      return { ...state, centralSite: null, localSites: [] }
    case 'memorial:replaceAll':
      return {
        ...state,
        centralSite: action.centralSite ? { ...action.centralSite } : null,
        localSites: action.localSites.map((s) => ({ ...s })),
      }
    case 'pink:updateMeta': {
      const i = findPinkIndex(state.pinkNodes, action.tempId)
      if (i < 0) throw new Error(`pink:updateMeta unknown tempId ${action.tempId}`)
      const next = [...state.pinkNodes]
      next[i] = {
        ...next[i],
        name: action.after.name,
        description: action.after.description,
      }
      return { ...state, pinkNodes: next }
    }
    case 'memorial:updateMeta': {
      if (action.scope === 'central') {
        const s = state.centralSite
        if (!s || s.tempId !== action.tempId) {
          throw new Error(`memorial:updateMeta central tempId mismatch ${action.tempId}`)
        }
        return {
          ...state,
          centralSite: {
            ...s,
            name: action.after.name,
            description: action.after.description,
          },
        }
      }
      const i = findLocalIndex(state.localSites, action.tempId)
      if (i < 0) throw new Error(`memorial:updateMeta unknown local tempId ${action.tempId}`)
      const next = [...state.localSites]
      next[i] = {
        ...next[i],
        name: action.after.name,
        description: action.after.description,
      }
      return { ...state, localSites: next }
    }
    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}

function invertAction(before: EditableMapState, action: EditAction): EditAction {
  switch (action.kind) {
    case 'pink:add':
      return {
        kind: 'pink:remove',
        node: { ...action.node },
        index:
          action.insertIndex !== undefined ? action.insertIndex : before.pinkNodes.length,
      }
    case 'pink:move':
      return {
        kind: 'pink:move',
        tempId: action.tempId,
        from: { ...action.to },
        to: { ...action.from },
      }
    case 'pink:remove':
      return {
        kind: 'pink:add',
        node: { ...action.node },
        insertIndex: action.index,
      }
    case 'pink:clear':
      return { kind: 'pink:replaceAll', nodes: action.before.map((n) => ({ ...n })) }
    case 'pink:replaceAll':
      return {
        kind: 'pink:clear',
        before: action.nodes.map((n) => ({ ...n })),
      }
    case 'memorial:setCentral':
      if (action.previous === null) {
        return { kind: 'memorial:removeCentral', previous: { ...action.site } }
      }
      return {
        kind: 'memorial:setCentral',
        site: { ...action.previous },
        previous: { ...action.site },
      }
    case 'memorial:removeCentral':
      return {
        kind: 'memorial:setCentral',
        site: { ...action.previous },
        previous: null,
      }
    case 'memorial:addLocal':
      return {
        kind: 'memorial:removeLocal',
        site: { ...action.site },
        index:
          action.insertIndex !== undefined ? action.insertIndex : before.localSites.length,
      }
    case 'memorial:moveLocal':
      return {
        kind: 'memorial:moveLocal',
        tempId: action.tempId,
        from: { ...action.to },
        to: { ...action.from },
      }
    case 'memorial:removeLocal':
      return {
        kind: 'memorial:addLocal',
        site: { ...action.site },
        insertIndex: action.index,
      }
    case 'memorial:clear':
      return {
        kind: 'memorial:replaceAll',
        centralSite: action.beforeCentral ? { ...action.beforeCentral } : null,
        localSites: action.beforeLocal.map((s) => ({ ...s })),
      }
    case 'memorial:replaceAll':
      return {
        kind: 'memorial:clear',
        beforeCentral: action.centralSite ? { ...action.centralSite } : null,
        beforeLocal: action.localSites.map((s) => ({ ...s })),
      }
    case 'pink:updateMeta':
      return {
        kind: 'pink:updateMeta',
        tempId: action.tempId,
        before: { ...action.after },
        after: { ...action.before },
      }
    case 'memorial:updateMeta':
      return {
        kind: 'memorial:updateMeta',
        scope: action.scope,
        tempId: action.tempId,
        before: { ...action.after },
        after: { ...action.before },
      }
    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}

export function applyEditAction(
  state: EditableMapState,
  history: EditHistory,
  action: EditAction,
): { state: EditableMapState; history: EditHistory } {
  const nextState = applyForward(state, action)
  const inverse = invertAction(state, action)
  return {
    state: nextState,
    history: {
      undoStack: [inverse, ...history.undoStack],
      redoStack: [],
    },
  }
}

export function undoOne(
  state: EditableMapState,
  history: EditHistory,
): { state: EditableMapState; history: EditHistory } {
  const [inverse, ...restUndo] = history.undoStack
  if (!inverse) {
    return { state, history }
  }
  const nextState = applyForward(state, inverse)
  const redoAction = invertAction(state, inverse)
  return {
    state: nextState,
    history: {
      undoStack: restUndo,
      redoStack: [redoAction, ...history.redoStack],
    },
  }
}

export function redoOne(
  state: EditableMapState,
  history: EditHistory,
): { state: EditableMapState; history: EditHistory } {
  const [redoAction, ...restRedo] = history.redoStack
  if (!redoAction) {
    return { state, history }
  }
  const nextState = applyForward(state, redoAction)
  const inverse = invertAction(state, redoAction)
  return {
    state: nextState,
    history: {
      undoStack: [inverse, ...history.undoStack],
      redoStack: restRedo,
    },
  }
}
