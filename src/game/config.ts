import type { MonsterType, TeamId, TowerType } from './types'

export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`

export const WORLD = {
  width: 2080,
  height: 720,
  mapLeft: 130,
  mapRight: 1950,
  mapTop: 62,
  mapBottom: 674,
  cols: 36,
  rows: 12,
  laneY: [138.5, 240.5, 342.5, 444.5, 546.5],
  leftBaseCol: 1,
  rightBaseCol: 34,
  baseRow: 6,
} as const

export const TEAM_META: Record<TeamId, { name: string; colour: string; sideLabel: string }> = {
  solar: { name: 'Solar Squad', colour: '#ffbd3e', sideLabel: 'Left side' },
  lunar: { name: 'Lunar Squad', colour: '#7ee7ff', sideLabel: 'Right side' },
}

export const TOWER_META: Record<TowerType, {
  name: string
  shortName: string
  sprite: string
  range: number
  damage: number
  cooldownMs: number
  challenge: number
  colour: string
}> = {
  bolt: { name: 'Bolt Tower', shortName: 'Bolt', sprite: assetUrl('sprites/turret_basic.png'), range: 150, damage: 13, cooldownMs: 660, challenge: 0, colour: '#39d7bc' },
  spray: { name: 'Spray Tower', shortName: 'Spray', sprite: assetUrl('sprites/turret_cluster.png'), range: 138, damage: 8, cooldownMs: 1000, challenge: 1, colour: '#ff9f43' },
  missile: { name: 'Missile Tower', shortName: 'Missile', sprite: assetUrl('sprites/turret_sidewinder.png'), range: 180, damage: 24, cooldownMs: 920, challenge: 2, colour: '#9bd9ff' },
  cluster: { name: 'Cluster Tower', shortName: 'Cluster', sprite: assetUrl('sprites/turrent_cluster_bomb.png'), range: 170, damage: 19, cooldownMs: 1600, challenge: 3, colour: '#ff79c8' },
}

export interface TowerLevelStats {
  range: number
  cooldownMs: number
  damage: number
  bulletSpeed?: number
  pelletCount?: number
  spreadRadians?: number
  missileCount?: number
  missileSpeed?: number
  missileTurnRate?: number
  explosionRadius?: number
  fragmentCount?: number
  fragmentDamage?: number
  threat: number
}

/** The first five levels are copied from the original single-player balance table. */
export const TOWER_STATS: Record<TowerType, TowerLevelStats[]> = {
  bolt: [
    { range: 150, cooldownMs: 660, damage: 13, bulletSpeed: 420, threat: 3.6 },
    { range: 168, cooldownMs: 330, damage: 13, bulletSpeed: 430, threat: 4.4 },
    { range: 186, cooldownMs: 230, damage: 14, bulletSpeed: 440, threat: 5.2 },
    { range: 205, cooldownMs: 180, damage: 16, bulletSpeed: 450, threat: 6.1 },
    { range: 225, cooldownMs: 150, damage: 18, bulletSpeed: 465, threat: 7.1 },
  ],
  spray: [
    { range: 138, cooldownMs: 1000, damage: 8, bulletSpeed: 390, pelletCount: 3, spreadRadians: .42, threat: 4 },
    { range: 158, cooldownMs: 670, damage: 8, bulletSpeed: 400, pelletCount: 4, spreadRadians: .48, threat: 4.8 },
    { range: 178, cooldownMs: 600, damage: 9, bulletSpeed: 410, pelletCount: 5, spreadRadians: .54, threat: 5.8 },
    { range: 198, cooldownMs: 550, damage: 10, bulletSpeed: 425, pelletCount: 6, spreadRadians: .6, threat: 6.7 },
    { range: 220, cooldownMs: 500, damage: 10, bulletSpeed: 440, pelletCount: 7, spreadRadians: .66, threat: 7.8 },
  ],
  missile: [
    { range: 180, cooldownMs: 920, damage: 24, missileCount: 1, missileSpeed: 165, missileTurnRate: 2, threat: 5 },
    { range: 202, cooldownMs: 530, damage: 27, missileCount: 1, missileSpeed: 185, missileTurnRate: 2.25, threat: 6.2 },
    { range: 226, cooldownMs: 650, damage: 28, missileCount: 2, missileSpeed: 205, missileTurnRate: 2.55, threat: 7.5 },
    { range: 252, cooldownMs: 540, damage: 31, missileCount: 2, missileSpeed: 230, missileTurnRate: 2.85, threat: 9 },
    { range: 282, cooldownMs: 650, damage: 32, missileCount: 3, missileSpeed: 255, missileTurnRate: 3.15, threat: 10.7 },
  ],
  cluster: [
    { range: 170, cooldownMs: 1600, damage: 19, bulletSpeed: 260, explosionRadius: 54, fragmentCount: 5, fragmentDamage: 6, threat: 5.6 },
    { range: 195, cooldownMs: 1100, damage: 24, bulletSpeed: 275, explosionRadius: 64, fragmentCount: 6, fragmentDamage: 8, threat: 7 },
    { range: 220, cooldownMs: 970, damage: 29, bulletSpeed: 292, explosionRadius: 74, fragmentCount: 8, fragmentDamage: 9, threat: 8.6 },
    { range: 246, cooldownMs: 930, damage: 35, bulletSpeed: 310, explosionRadius: 86, fragmentCount: 9, fragmentDamage: 11, threat: 10.4 },
    { range: 274, cooldownMs: 1050, damage: 42, bulletSpeed: 330, explosionRadius: 98, fragmentCount: 12, fragmentDamage: 13, threat: 12.5 },
  ],
}

export const getTowerStats = (tower: { type: TowerType; level: number }) =>
  TOWER_STATS[tower.type][Math.max(1, Math.min(5, tower.level)) - 1]

export const MONSTER_META: Record<MonsterType, {
  name: string
  description: string
  sprite: string
  health: number
  speed: number
  baseDamage: number
  spawnSeconds: number
  challenge: number
}> = {
  scout: { name: 'Nibble', description: 'Quick & light', sprite: assetUrl('sprites/monster_1_run.png'), health: 48, speed: 45, baseDamage: 5, spawnSeconds: 8, challenge: 0 },
  runner: { name: 'Zapper', description: 'Very speedy', sprite: assetUrl('sprites/monster_2_run.png'), health: 72, speed: 58, baseDamage: 7, spawnSeconds: 11, challenge: 1 },
  brute: { name: 'Chomper', description: 'Tough attacker', sprite: assetUrl('sprites/monster_3_run.png'), health: 155, speed: 32, baseDamage: 13, spawnSeconds: 15, challenge: 2 },
  titan: { name: 'Mega Moo', description: 'Slow & mighty', sprite: assetUrl('sprites/monster_4_run.png'), health: 290, speed: 22, baseDamage: 24, spawnSeconds: 22, challenge: 3 },
}

export const TOWER_TYPES = Object.keys(TOWER_META) as TowerType[]
export const MONSTER_TYPES = Object.keys(MONSTER_META) as MonsterType[]

export const BALANCE_RULES = {
  enabled: true,
  healthGapBeforeBoost: 0.18,
  maxBoost: 0.14,
  towerDamageWeight: 0.65,
  baseShieldWeight: 0.35,
} as const

export const cellWidth = (WORLD.mapRight - WORLD.mapLeft) / WORLD.cols
export const cellHeight = (WORLD.mapBottom - WORLD.mapTop) / WORLD.rows

export type TerrainType = 'grass' | 'tarmac' | 'tree'

/** A mirrored, deterministic map keeps both halves fair and identical on every peer. */
export function terrainAt(col: number, row: number): TerrainType {
  const mirroredCol = col < WORLD.cols / 2 ? col : WORLD.cols - 1 - col
  const laneRows = [1, 3, 5, 7, 9]
  if (laneRows.includes(row)) return 'tarmac'
  if (mirroredCol < 3 || mirroredCol > WORLD.cols / 2 - 3) return 'grass'
  const hash = Math.abs(((mirroredCol + 11) * 73856093) ^ ((row + 17) * 19349663)) % 100
  if (hash < 17) return 'tree'
  if (hash < 29) return 'tarmac'
  return 'grass'
}

export function cellCentre(col: number, row: number) {
  return {
    x: WORLD.mapLeft + (col + 0.5) * cellWidth,
    y: WORLD.mapTop + (row + 0.5) * cellHeight,
  }
}

export function isCellOnTeamSide(teamId: TeamId, col: number) {
  return teamId === 'solar' ? col < WORLD.cols / 2 : col >= WORLD.cols / 2
}

export function baseCell(teamId: TeamId) {
  return { col: teamId === 'solar' ? WORLD.leftBaseCol : WORLD.rightBaseCol, row: WORLD.baseRow }
}

export function baseCentre(teamId: TeamId) {
  const base = baseCell(teamId)
  return cellCentre(base.col, base.row)
}

export function isBaseFootprintCell(col: number, row: number) {
  return (['solar', 'lunar'] as TeamId[]).some((teamId) => {
    const base = baseCell(teamId)
    return Math.abs(col - base.col) <= 1 && Math.abs(row - base.row) <= 1
  })
}
