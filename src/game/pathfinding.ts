import { baseCell, cellCentre, cellHeight, cellWidth, getTowerStats, terrainAt, WORLD } from './config'
import type { TeamId, TowerState } from './types'

export interface Point { x: number; y: number }
export interface Cell { col: number; row: number }
export interface FlowField { costToBase: number[][]; direction: Point[][] }

const TERRAIN_COST = { grass: 1.15, tarmac: .72, tree: Number.POSITIVE_INFINITY }
export const TERRAIN_SPEED = { grass: .92, tarmac: 1.22, tree: 0 }
const THREAT_WEIGHT = 5.2
const MAX_THREAT = 18

export function inBounds(col: number, row: number) {
  return col >= 0 && row >= 0 && col < WORLD.cols && row < WORLD.rows
}

export function isBlocked(col: number, row: number) {
  return !inBounds(col, row) || terrainAt(col, row) === 'tree'
}

export function worldToCell(point: Point): Cell | null {
  const col = Math.floor((point.x - WORLD.mapLeft) / cellWidth)
  const row = Math.floor((point.y - WORLD.mapTop) / cellHeight)
  return inBounds(col, row) ? { col, row } : null
}

function neighbors(cell: Cell) {
  const result: Cell[] = []
  for (let row = -1; row <= 1; row += 1) {
    for (let col = -1; col <= 1; col += 1) {
      if ((col || row) && inBounds(cell.col + col, cell.row + row)) result.push({ col: cell.col + col, row: cell.row + row })
    }
  }
  return result
}

function canStep(from: Cell, to: Cell) {
  if (isBlocked(to.col, to.row)) return false
  if (from.col === to.col || from.row === to.row) return true
  return !isBlocked(from.col, to.row) && !isBlocked(to.col, from.row)
}

export function raycastCells(from: Point, to: Point): Cell[] {
  const start = worldToCell(from)
  const end = worldToCell(to)
  if (!start || !end) return []
  const fromX = (from.x - WORLD.mapLeft) / cellWidth
  const fromY = (from.y - WORLD.mapTop) / cellHeight
  const toX = (to.x - WORLD.mapLeft) / cellWidth
  const toY = (to.y - WORLD.mapTop) / cellHeight
  const dx = toX - fromX
  const dy = toY - fromY
  const stepX = Math.sign(dx)
  const stepY = Math.sign(dy)
  const deltaX = stepX === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dx)
  const deltaY = stepY === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dy)
  const intBound = (startValue: number, delta: number) => delta > 0
    ? (Math.floor(startValue + 1) - startValue) / delta
    : delta < 0 ? (startValue - Math.floor(startValue)) / -delta : Number.POSITIVE_INFINITY
  let maxX = intBound(fromX, dx)
  let maxY = intBound(fromY, dy)
  let col = start.col
  let row = start.row
  const cells: Cell[] = [{ col, row }]
  for (let steps = 0; steps < WORLD.cols * WORLD.rows * 2 && (col !== end.col || row !== end.row); steps += 1) {
    if (maxX < maxY) { maxX += deltaX; col += stepX }
    else if (maxY < maxX) { maxY += deltaY; row += stepY }
    else { maxX += deltaX; maxY += deltaY; col += stepX; row += stepY }
    if (!inBounds(col, row)) break
    cells.push({ col, row })
  }
  return cells
}

export function hasLineOfSight(from: Point, to: Point) {
  const cells = raycastCells(from, to)
  return cells.length > 0 && cells.every((cell) => !isBlocked(cell.col, cell.row))
}

function threatGrid(movingTeam: TeamId, towers: TowerState[]) {
  const threat = Array.from({ length: WORLD.rows }, () => Array(WORLD.cols).fill(0) as number[])
  for (const tower of towers) {
    if (tower.teamId === movingTeam) continue
    const stats = getTowerStats(tower)
    const origin = cellCentre(tower.col, tower.row)
    const colRadius = Math.ceil(stats.range / cellWidth)
    const rowRadius = Math.ceil(stats.range / cellHeight)
    for (let row = tower.row - rowRadius; row <= tower.row + rowRadius; row += 1) {
      for (let col = tower.col - colRadius; col <= tower.col + colRadius; col += 1) {
        if (!inBounds(col, row) || isBlocked(col, row)) continue
        const target = cellCentre(col, row)
        const distance = Math.hypot(target.x - origin.x, target.y - origin.y)
        if (distance > stats.range || !hasLineOfSight(origin, target)) continue
        const falloff = 1 - Math.min(.55, distance / stats.range * .55)
        threat[row][col] = Math.min(MAX_THREAT, threat[row][col] + stats.threat * THREAT_WEIGHT * falloff)
      }
    }
  }
  return threat
}

export function buildFlowField(movingTeam: TeamId, towers: TowerState[], ignoreThreat = false): FlowField {
  const targetTeam: TeamId = movingTeam === 'solar' ? 'lunar' : 'solar'
  const target = baseCell(targetTeam)
  const costs = Array.from({ length: WORLD.rows }, () => Array(WORLD.cols).fill(Number.POSITIVE_INFINITY) as number[])
  const direction = Array.from({ length: WORLD.rows }, () => Array.from({ length: WORLD.cols }, () => ({ x: 0, y: 0 })))
  const threat = ignoreThreat ? Array.from({ length: WORLD.rows }, () => Array(WORLD.cols).fill(0) as number[]) : threatGrid(movingTeam, towers)
  const queue: { cell: Cell; cost: number }[] = []
  for (let row = target.row - 1; row <= target.row + 1; row += 1) {
    for (let col = target.col - 1; col <= target.col + 1; col += 1) {
      if (!isBlocked(col, row)) { costs[row][col] = 0; queue.push({ cell: { col, row }, cost: 0 }) }
    }
  }
  while (queue.length) {
    let cheapest = 0
    for (let index = 1; index < queue.length; index += 1) if (queue[index].cost < queue[cheapest].cost) cheapest = index
    const current = queue.splice(cheapest, 1)[0]
    if (current.cost !== costs[current.cell.row][current.cell.col]) continue
    for (const next of neighbors(current.cell)) {
      if (!canStep(current.cell, next)) continue
      const diagonal = next.col !== current.cell.col && next.row !== current.cell.row
      const cost = current.cost + (TERRAIN_COST[terrainAt(next.col, next.row)] + threat[next.row][next.col]) * (diagonal ? Math.SQRT2 : 1)
      if (cost < costs[next.row][next.col]) { costs[next.row][next.col] = cost; queue.push({ cell: next, cost }) }
    }
  }
  for (let row = 0; row < WORLD.rows; row += 1) {
    for (let col = 0; col < WORLD.cols; col += 1) {
      if (isBlocked(col, row) || !Number.isFinite(costs[row][col])) continue
      let best = { col, row }
      let bestCost = costs[row][col]
      for (const next of neighbors({ col, row })) {
        if (canStep({ col, row }, next) && costs[next.row][next.col] < bestCost) { best = next; bestCost = costs[next.row][next.col] }
      }
      const dx = best.col - col
      const dy = best.row - row
      const length = Math.hypot(dx, dy) || 1
      direction[row][col] = { x: dx / length, y: dy / length }
    }
  }
  return { costToBase: costs, direction }
}

export function sampleDirection(field: FlowField, point: Point) {
  const cell = worldToCell(point)
  return cell ? field.direction[cell.row][cell.col] : { x: 0, y: 0 }
}

export function costAt(field: FlowField, point: Point) {
  const cell = worldToCell(point)
  return cell ? field.costToBase[cell.row][cell.col] : Number.POSITIVE_INFINITY
}
