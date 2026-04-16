import { describe, expect, it } from 'vitest'
import type { PendingSite } from '../../supabase/memorialSites'
import {
  applyEditAction,
  canRedo,
  canUndo,
  createEmptyEditHistory,
  redoOne,
  undoOne,
  type EditableMapState,
  type EditAction,
  type PendingPinkNode,
} from './editHistory'

const emptyState = (): EditableMapState => ({
  pinkNodes: [],
  centralSite: null,
  localSites: [],
})

const pink = (tempId: string, lat: number, lng: number): PendingPinkNode => ({
  tempId,
  name: null,
  description: null,
  lat,
  lng,
})

const localSite = (tempId: string, lat: number, lng: number): PendingSite => ({
  tempId,
  name: null,
  description: null,
  lat,
  lng,
  feature_type: 'local',
})

const centralSite = (tempId: string, lat: number, lng: number): PendingSite => ({
  tempId,
  name: null,
  description: null,
  lat,
  lng,
  feature_type: 'central',
})

describe('editHistory', () => {
  it('undoes and redoes a pink-node add action', () => {
    const start = emptyState()
    const addPink: EditAction = {
      kind: 'pink:add',
      node: pink('p1', 31.4, 34.5),
    }

    const applied = applyEditAction(start, createEmptyEditHistory(), addPink)
    expect(applied.state.pinkNodes).toHaveLength(1)
    expect(canUndo(applied.history)).toBe(true)

    const undone = undoOne(applied.state, applied.history)
    expect(undone.state.pinkNodes).toHaveLength(0)
    expect(canRedo(undone.history)).toBe(true)

    const redone = redoOne(undone.state, undone.history)
    expect(redone.state.pinkNodes).toHaveLength(1)
    expect(redone.state.pinkNodes[0]?.lat).toBe(31.4)
  })

  it('undoes and redoes pink move, remove (order preserved), and clear', () => {
    let state = emptyState()
    let history = createEmptyEditHistory()

    const a = pink('a', 1, 1)
    const b = pink('b', 2, 2)
    const c = pink('c', 3, 3)

    ;({ state, history } = applyEditAction(state, history, { kind: 'pink:add', node: a }))
    ;({ state, history } = applyEditAction(state, history, { kind: 'pink:add', node: b }))
    ;({ state, history } = applyEditAction(state, history, { kind: 'pink:add', node: c }))

    const move: EditAction = {
      kind: 'pink:move',
      tempId: 'b',
      from: { lat: 2, lng: 2 },
      to: { lat: 9, lng: 9 },
    }
    ;({ state, history } = applyEditAction(state, history, move))
    expect(state.pinkNodes.find((n) => n.tempId === 'b')).toMatchObject({ lat: 9, lng: 9 })

    ;({ state, history } = undoOne(state, history))
    expect(state.pinkNodes.find((n) => n.tempId === 'b')).toMatchObject({ lat: 2, lng: 2 })
    ;({ state, history } = redoOne(state, history))
    expect(state.pinkNodes.find((n) => n.tempId === 'b')).toMatchObject({ lat: 9, lng: 9 })

    const remove: EditAction = { kind: 'pink:remove', node: { ...b, lat: 9, lng: 9 }, index: 1 }
    ;({ state, history } = applyEditAction(state, history, remove))
    expect(state.pinkNodes.map((n) => n.tempId)).toEqual(['a', 'c'])

    ;({ state, history } = undoOne(state, history))
    expect(state.pinkNodes.map((n) => n.tempId)).toEqual(['a', 'b', 'c'])

    const clear: EditAction = { kind: 'pink:clear', before: [...state.pinkNodes] }
    ;({ state, history } = applyEditAction(state, history, clear))
    expect(state.pinkNodes).toHaveLength(0)

    ;({ state, history } = undoOne(state, history))
    expect(state.pinkNodes.map((n) => n.tempId)).toEqual(['a', 'b', 'c'])
    ;({ state, history } = redoOne(state, history))
    expect(state.pinkNodes).toHaveLength(0)
  })

  it('undoes and redoes memorial actions (central, local, clear)', () => {
    let state = emptyState()
    let history = createEmptyEditHistory()

    const c1 = centralSite('cen1', 10, 20)
    ;({ state, history } = applyEditAction(state, history, {
      kind: 'memorial:setCentral',
      site: c1,
      previous: null,
    }))
    expect(state.centralSite?.tempId).toBe('cen1')

    ;({ state, history } = undoOne(state, history))
    expect(state.centralSite).toBeNull()
    ;({ state, history } = redoOne(state, history))
    expect(state.centralSite?.tempId).toBe('cen1')

    const c2 = centralSite('cen2', 11, 21)
    ;({ state, history } = applyEditAction(state, history, {
      kind: 'memorial:setCentral',
      site: c2,
      previous: c1,
    }))
    expect(state.centralSite?.tempId).toBe('cen2')

    ;({ state, history } = undoOne(state, history))
    expect(state.centralSite?.tempId).toBe('cen1')
    ;({ state, history } = redoOne(state, history))
    expect(state.centralSite?.tempId).toBe('cen2')

    ;({ state, history } = applyEditAction(state, history, {
      kind: 'memorial:removeCentral',
      previous: c2,
    }))
    expect(state.centralSite).toBeNull()
    ;({ state, history } = undoOne(state, history))
    expect(state.centralSite?.tempId).toBe('cen2')

    const l1 = localSite('loc1', 1, 1)
    const l2 = localSite('loc2', 2, 2)
    ;({ state, history } = applyEditAction(state, history, { kind: 'memorial:addLocal', site: l1 }))
    ;({ state, history } = applyEditAction(state, history, { kind: 'memorial:addLocal', site: l2 }))
    expect(state.localSites.map((s) => s.tempId)).toEqual(['loc1', 'loc2'])

    ;({ state, history } = applyEditAction(state, history, {
      kind: 'memorial:moveLocal',
      tempId: 'loc1',
      from: { lat: 1, lng: 1 },
      to: { lat: 5, lng: 5 },
    }))
    expect(state.localSites[0]).toMatchObject({ lat: 5, lng: 5 })

    ;({ state, history } = undoOne(state, history))
    expect(state.localSites[0]).toMatchObject({ lat: 1, lng: 1 })

    ;({ state, history } = applyEditAction(state, history, {
      kind: 'memorial:removeLocal',
      site: l1,
      index: 0,
    }))
    expect(state.localSites.map((s) => s.tempId)).toEqual(['loc2'])

    ;({ state, history } = undoOne(state, history))
    expect(state.localSites.map((s) => s.tempId)).toEqual(['loc1', 'loc2'])

    ;({ state, history } = applyEditAction(state, history, {
      kind: 'memorial:clear',
      beforeCentral: state.centralSite,
      beforeLocal: [...state.localSites],
    }))
    expect(state.centralSite).toBeNull()
    expect(state.localSites).toHaveLength(0)

    ;({ state, history } = undoOne(state, history))
    expect(state.centralSite?.tempId).toBe('cen2')
    expect(state.localSites.map((s) => s.tempId)).toEqual(['loc1', 'loc2'])
  })

  it('pink: clear -> undo -> redo -> undo restores the same nodes', () => {
    let state = emptyState()
    let history = createEmptyEditHistory()

    const a = pink('a', 1, 1)
    const b = pink('b', 2, 2)
    ;({ state, history } = applyEditAction(state, history, { kind: 'pink:add', node: a }))
    ;({ state, history } = applyEditAction(state, history, { kind: 'pink:add', node: b }))

    const snapshot = [...state.pinkNodes]
    const clear: EditAction = { kind: 'pink:clear', before: snapshot }
    ;({ state, history } = applyEditAction(state, history, clear))
    expect(state.pinkNodes).toHaveLength(0)

    ;({ state, history } = undoOne(state, history))
    expect(state.pinkNodes.map((n) => n.tempId)).toEqual(['a', 'b'])

    ;({ state, history } = redoOne(state, history))
    expect(state.pinkNodes).toHaveLength(0)

    ;({ state, history } = undoOne(state, history))
    expect(state.pinkNodes.map((n) => n.tempId)).toEqual(['a', 'b'])
  })

  it('memorial: clear -> undo -> redo -> undo restores central and locals', () => {
    let state = emptyState()
    let history = createEmptyEditHistory()

    const cen = centralSite('cen', 10, 20)
    const loc = localSite('loc', 3, 4)
    ;({ state, history } = applyEditAction(state, history, {
      kind: 'memorial:setCentral',
      site: cen,
      previous: null,
    }))
    ;({ state, history } = applyEditAction(state, history, { kind: 'memorial:addLocal', site: loc }))

    const clear: EditAction = {
      kind: 'memorial:clear',
      beforeCentral: state.centralSite,
      beforeLocal: [...state.localSites],
    }
    ;({ state, history } = applyEditAction(state, history, clear))
    expect(state.centralSite).toBeNull()
    expect(state.localSites).toHaveLength(0)

    ;({ state, history } = undoOne(state, history))
    expect(state.centralSite?.tempId).toBe('cen')
    expect(state.localSites.map((s) => s.tempId)).toEqual(['loc'])

    ;({ state, history } = redoOne(state, history))
    expect(state.centralSite).toBeNull()
    expect(state.localSites).toHaveLength(0)

    ;({ state, history } = undoOne(state, history))
    expect(state.centralSite?.tempId).toBe('cen')
    expect(state.localSites.map((s) => s.tempId)).toEqual(['loc'])
  })

  it('clears redo stack when applying a new action after an undo', () => {
    let state = emptyState()
    let history = createEmptyEditHistory()

    const first: EditAction = { kind: 'pink:add', node: pink('x', 1, 2) }
    ;({ state, history } = applyEditAction(state, history, first))
    ;({ state, history } = undoOne(state, history))
    expect(canRedo(history)).toBe(true)

    const second: EditAction = { kind: 'pink:add', node: pink('y', 3, 4) }
    ;({ state, history } = applyEditAction(state, history, second))

    expect(history.redoStack).toHaveLength(0)
    expect(canRedo(history)).toBe(false)
    expect(state.pinkNodes.map((n) => n.tempId)).toEqual(['y'])
  })

  it('mixed local edits: add pink -> move pink -> remove local memorial, then undo x3 and redo x3', () => {
    const loc = localSite('loc1', 1, 1)
    let state: EditableMapState = {
      pinkNodes: [],
      centralSite: null,
      localSites: [loc],
    }
    let history = createEmptyEditHistory()

    const p1 = pink('p1', 10, 10)
    ;({ state, history } = applyEditAction(state, history, { kind: 'pink:add', node: p1 }))
    expect(state.pinkNodes).toEqual([p1])
    expect(state.localSites.map((s) => s.tempId)).toEqual(['loc1'])

    ;({ state, history } = applyEditAction(state, history, {
      kind: 'pink:move',
      tempId: 'p1',
      from: { lat: 10, lng: 10 },
      to: { lat: 11, lng: 12 },
    }))
    expect(state.pinkNodes[0]).toMatchObject({ tempId: 'p1', lat: 11, lng: 12 })

    ;({ state, history } = applyEditAction(state, history, {
      kind: 'memorial:removeLocal',
      site: loc,
      index: 0,
    }))
    expect(state.pinkNodes[0]).toMatchObject({ tempId: 'p1', lat: 11, lng: 12 })
    expect(state.localSites).toHaveLength(0)
    expect(state.centralSite).toBeNull()
    expect(canUndo(history)).toBe(true)
    expect(canRedo(history)).toBe(false)

    ;({ state, history } = undoOne(state, history))
    expect(state.localSites).toHaveLength(1)
    expect(state.localSites[0]).toMatchObject({ tempId: 'loc1', lat: 1, lng: 1, feature_type: 'local' })
    expect(state.pinkNodes[0]).toMatchObject({ tempId: 'p1', lat: 11, lng: 12 })

    ;({ state, history } = undoOne(state, history))
    expect(state.pinkNodes[0]).toMatchObject({ tempId: 'p1', lat: 10, lng: 10 })
    expect(state.localSites.map((s) => s.tempId)).toEqual(['loc1'])

    ;({ state, history } = undoOne(state, history))
    expect(state.pinkNodes).toHaveLength(0)
    expect(state.localSites.map((s) => s.tempId)).toEqual(['loc1'])
    expect(canRedo(history)).toBe(true)

    ;({ state, history } = redoOne(state, history))
    expect(state.pinkNodes).toEqual([p1])
    expect(state.localSites.map((s) => s.tempId)).toEqual(['loc1'])

    ;({ state, history } = redoOne(state, history))
    expect(state.pinkNodes[0]).toMatchObject({ tempId: 'p1', lat: 11, lng: 12 })
    expect(state.localSites.map((s) => s.tempId)).toEqual(['loc1'])

    ;({ state, history } = redoOne(state, history))
    expect(state.pinkNodes[0]).toMatchObject({ tempId: 'p1', lat: 11, lng: 12 })
    expect(state.localSites).toHaveLength(0)
    expect(canRedo(history)).toBe(false)
    expect(canUndo(history)).toBe(true)
  })
})
