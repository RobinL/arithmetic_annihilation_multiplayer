import { useEffect, useRef } from 'react'
import { assetUrl, baseCell, baseCentre, cellCentre, cellHeight, cellWidth, getTowerStats, isBaseFootprintCell, isCellOnTeamSide, MONSTER_META, TEAM_META, terrainAt, TOWER_META, WORLD } from '../game/config'
import { CanvasProjectileEffects } from '../game/canvasProjectileEffects'
import type { GameSnapshot, MonsterType, ProjectileState, TeamId, TowerType, UnitState } from '../game/types'

interface Props {
  snapshot: GameSnapshot
  localTeamId: TeamId
  selectedTower: TowerType
  onGridClick: (col: number, row: number) => void
}

interface RenderUnit {
  id: number
  x: number
  y: number
  health: number
  lastHealth: number
  bornAt: number
  hurtUntil: number
  data: UnitState
}

interface RenderTower {
  bornAt: number
  level: number
  pulseUntil: number
}

interface Effect {
  id: number
  kind: 'impact' | 'death'
  x: number
  y: number
  startedAt: number
  duration: number
  teamId: TeamId
  colour: string
}

const imageCache = new Map<string, HTMLImageElement>()
const monsterNumber: Record<MonsterType, number> = { scout: 1, runner: 2, brute: 3, titan: 4 }

function getImage(src: string) {
  if (!imageCache.has(src)) {
    const image = new Image()
    image.src = src
    imageCache.set(src, image)
  }
  return imageCache.get(src)!
}

function waitForImage(src: string) {
  const image = getImage(src)
  if (image.complete) return Promise.resolve()
  return new Promise<void>((resolve) => {
    image.addEventListener('load', () => resolve(), { once: true })
    image.addEventListener('error', () => resolve(), { once: true })
  })
}

function monsterTexture(type: MonsterType, state: 'run' | 'hurt' | 'stop') {
  return assetUrl(`sprites/monster_${monsterNumber[type]}_${state}.png`)
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  src: string,
  x: number,
  y: number,
  size: number,
  inverted: boolean,
  flip = false,
  rotation = 0,
  scaleX = 1,
  scaleY = 1,
  alpha = 1,
) {
  const image = getImage(src)
  if (!image.complete || !image.naturalWidth) return
  const ratio = image.naturalWidth / image.naturalHeight
  const width = ratio >= 1 ? size : size * ratio
  const height = ratio >= 1 ? size / ratio : size
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.scale((flip ? -1 : 1) * scaleX, scaleY)
  if (inverted) ctx.filter = 'invert(1)'
  ctx.drawImage(image, -width / 2, -height / 2, width, height)
  ctx.restore()
}

function easeOutBack(t: number) {
  const c = 1.70158
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}

export function GameCanvas({ snapshot, localTeamId, selectedTower, onGridClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const snapshotRef = useRef(snapshot)
  const receivedAtRef = useRef(0)
  const renderUnitsRef = useRef(new Map<number, RenderUnit>())
  const renderTowersRef = useRef(new Map<number, RenderTower>())
  const effectsRef = useRef<Effect[]>([])
  const priorProjectileIdsRef = useRef(new Map<number, ProjectileState>())
  const seenExplosionIdsRef = useRef(new Set<number>())
  const hoverRef = useRef<{ col: number; row: number } | null>(null)
  const selectedTowerRef = useRef(selectedTower)
  const baseHealthRef = useRef({ solar: snapshot.teams.solar.baseHealth, lunar: snapshot.teams.lunar.baseHealth })
  const baseHitUntilRef = useRef({ solar: 0, lunar: 0 })
  const effectIdRef = useRef(1)
  const soundAtRef = useRef(0)
  const shotSoundAtRef = useRef(0)

  useEffect(() => {
    selectedTowerRef.current = selectedTower
  }, [selectedTower])

  useEffect(() => {
    const now = performance.now()
    snapshotRef.current = snapshot
    receivedAtRef.current = now
    for (const teamId of ['solar', 'lunar'] as TeamId[]) {
      if (snapshot.teams[teamId].baseHealth < baseHealthRef.current[teamId]) {
        baseHitUntilRef.current[teamId] = now + 360
      }
      baseHealthRef.current[teamId] = snapshot.teams[teamId].baseHealth
    }
  }, [snapshot])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = WORLD.width
    canvas.height = WORLD.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cancelled = false
    let frame = 0
    let previousTime = performance.now()
    const projectileEffects = new CanvasProjectileEffects()
    const staticLayer = document.createElement('canvas')
    staticLayer.width = WORLD.width
    staticLayer.height = WORLD.height

    const terrainSources = [
      ...[1, 2, 3, 4, 5].map((number) => assetUrl(`sprites/grass_${number}.png`)),
      ...[1, 2, 3].map((number) => assetUrl(`sprites/tarmac_${number}.png`)),
      ...[1, 2].map((number) => assetUrl(`sprites/tree_${number}.png`)),
    ]
    const dynamicSources = [
      assetUrl('sprites/base_1.png'),
      ...Object.values(TOWER_META).map((meta) => meta.sprite),
      ...Object.keys(MONSTER_META).flatMap((type) => ['run', 'hurt', 'stop'].map((state) => monsterTexture(type as MonsterType, state as 'run' | 'hurt' | 'stop'))),
    ]

    const buildStaticLayer = () => {
      const mapCtx = staticLayer.getContext('2d')!
      const background = mapCtx.createLinearGradient(0, 0, WORLD.width, WORLD.height)
      background.addColorStop(0, '#132119')
      background.addColorStop(1, '#1b3023')
      mapCtx.fillStyle = background
      mapCtx.fillRect(0, 0, WORLD.width, WORLD.height)

      for (let row = 0; row < WORLD.rows; row += 1) {
        for (let col = 0; col < WORLD.cols; col += 1) {
          const terrain = terrainAt(col, row)
          const hash = Math.abs(((col + 1) * 73856093) ^ ((row + 1) * 19349663))
          const count = terrain === 'grass' ? 5 : terrain === 'tarmac' ? 3 : 2
          const source = assetUrl(`sprites/${terrain}_${(hash % count) + 1}.png`)
          const image = getImage(source)
          const cellTeam: TeamId = col < WORLD.cols / 2 ? 'solar' : 'lunar'
          mapCtx.save()
          if (cellTeam !== localTeamId) mapCtx.filter = 'invert(1)'
          mapCtx.drawImage(image, WORLD.mapLeft + col * cellWidth, WORLD.mapTop + row * cellHeight, cellWidth + 0.7, cellHeight + 0.7)
          mapCtx.restore()
        }
      }

      const middle = (WORLD.mapLeft + WORLD.mapRight) / 2
      mapCtx.fillStyle = 'rgba(8,18,13,.15)'
      mapCtx.fillRect(middle - 3, WORLD.mapTop, 6, WORLD.mapBottom - WORLD.mapTop)
      mapCtx.strokeStyle = 'rgba(247,240,214,.28)'
      mapCtx.lineWidth = 2
      mapCtx.strokeRect(WORLD.mapLeft, WORLD.mapTop, WORLD.mapRight - WORLD.mapLeft, WORLD.mapBottom - WORLD.mapTop)
      mapCtx.strokeStyle = 'rgba(19,33,25,.28)'
      mapCtx.strokeRect(WORLD.mapLeft + 2, WORLD.mapTop + 2, (WORLD.mapRight - WORLD.mapLeft) / 2 - 4, WORLD.mapBottom - WORLD.mapTop - 4)
      mapCtx.strokeRect(middle + 2, WORLD.mapTop + 2, (WORLD.mapRight - WORLD.mapLeft) / 2 - 4, WORLD.mapBottom - WORLD.mapTop - 4)

      for (const teamId of ['solar', 'lunar'] as TeamId[]) {
        const x = teamId === 'solar' ? WORLD.mapLeft + 10 : WORLD.mapRight - 10
        const direction = teamId === 'solar' ? 1 : -1
        mapCtx.save()
        if (teamId !== localTeamId) mapCtx.filter = 'invert(1)'
        mapCtx.fillStyle = '#f3b64b'
        for (const y of WORLD.laneY) {
          mapCtx.beginPath()
          mapCtx.moveTo(x + direction * 19, y)
          mapCtx.lineTo(x - direction * 10, y - 13)
          mapCtx.lineTo(x - direction * 10, y + 13)
          mapCtx.closePath()
          mapCtx.fill()
        }
        mapCtx.restore()

        const base = baseCell(teamId)
        mapCtx.save()
        mapCtx.strokeStyle = teamId === localTeamId ? 'rgba(19,33,25,.42)' : 'rgba(247,240,214,.36)'
        mapCtx.lineWidth = 2
        mapCtx.strokeRect(
          WORLD.mapLeft + (base.col - 1) * cellWidth + 1,
          WORLD.mapTop + (base.row - 1) * cellHeight + 1,
          cellWidth * 3 - 2,
          cellHeight * 3 - 2,
        )
        mapCtx.restore()
      }
    }

    const playImpactSound = (death = false) => {
      const now = performance.now()
      if (now - soundAtRef.current < 115) return
      soundAtRef.current = now
      const audio = new Audio(assetUrl(death ? 'audio/ow_death.mp3' : 'audio/ow_hurt.mp3'))
      audio.volume = death ? 0.2 : 0.1
      audio.play().catch(() => undefined)
    }

    const playShotSound = () => {
      const now = performance.now()
      if (now - shotSoundAtRef.current < 70) return
      shotSoundAtRef.current = now
      const audio = new Audio(assetUrl('audio/pop.mp3'))
      audio.volume = .18
      audio.play().catch(() => undefined)
    }

    const addEffect = (kind: Effect['kind'], x: number, y: number, teamId: TeamId, colour: string, now: number) => {
      effectsRef.current.push({ id: effectIdRef.current++, kind, x, y, teamId, colour, startedAt: now, duration: kind === 'death' ? 620 : 310 })
    }

    const syncRenderState = (now: number) => {
      const current = snapshotRef.current
      const targetIds = new Set(current.units.map((unit) => unit.id))
      for (const unit of current.units) {
        const render = renderUnitsRef.current.get(unit.id)
        if (!render) {
          renderUnitsRef.current.set(unit.id, { id: unit.id, x: unit.x, y: unit.y, health: unit.health, lastHealth: unit.health, bornAt: now, hurtUntil: unit.hurtFlashMs > 0 ? now + unit.hurtFlashMs : 0, data: unit })
          continue
        }
        if (unit.health < render.lastHealth) {
          render.hurtUntil = now + 190
          playImpactSound(false)
        }
        render.lastHealth = unit.health
        render.health += (unit.health - render.health) * 0.6
        render.data = unit
      }
      for (const [unitId, render] of renderUnitsRef.current) {
        if (!targetIds.has(unitId)) {
          addEffect('death', render.x, render.y, render.data.teamId, TEAM_META[render.data.teamId].colour, now)
          renderUnitsRef.current.delete(unitId)
          playImpactSound(true)
        }
      }

      const towerIds = new Set(current.towers.map((tower) => tower.id))
      for (const tower of current.towers) {
        const render = renderTowersRef.current.get(tower.id)
        if (!render) renderTowersRef.current.set(tower.id, { bornAt: now, level: tower.level, pulseUntil: 0 })
        else if (tower.level > render.level) {
          render.level = tower.level
          render.pulseUntil = now + 520
        }
      }
      for (const towerId of renderTowersRef.current.keys()) if (!towerIds.has(towerId)) renderTowersRef.current.delete(towerId)

      const currentProjectiles = new Map(current.projectiles.map((projectile) => [projectile.id, projectile]))
      if (current.projectiles.some((projectile) => projectile.type !== 'fragment' && !priorProjectileIdsRef.current.has(projectile.id))) playShotSound()
      for (const [id, projectile] of priorProjectileIdsRef.current) {
        if (!currentProjectiles.has(id) && projectile.type !== 'cluster') projectileEffects.spawnImpact(projectile.teamId, projectile.x, projectile.y, projectile.type)
      }
      priorProjectileIdsRef.current = currentProjectiles
      for (const explosion of current.explosions) {
        if (seenExplosionIdsRef.current.has(explosion.id)) continue
        seenExplosionIdsRef.current.add(explosion.id)
        projectileEffects.spawnExplosion(explosion.teamId, explosion.x, explosion.y, explosion.radius)
      }
    }

    const drawBase = (teamId: TeamId, now: number) => {
      const current = snapshotRef.current
      const base = baseCentre(teamId)
      const hitRemaining = Math.max(0, baseHitUntilRef.current[teamId] - now)
      const shake = hitRemaining > 0 ? Math.sin(now * 0.12) * 5 * (hitRemaining / 360) : 0
      ctx.save()
      if (hitRemaining > 0) {
        ctx.shadowColor = '#ff4664'
        ctx.shadowBlur = 25
      }
      drawSprite(ctx, assetUrl('sprites/base_1.png'), base.x + shake, base.y, Math.min(cellWidth, cellHeight) * 3, teamId !== localTeamId, teamId === 'lunar')
      ctx.restore()
      const team = current.teams[teamId]
      const barX = base.x - 55
      const barY = base.y + cellHeight * 1.36
      ctx.fillStyle = 'rgba(9,18,13,.88)'; ctx.fillRect(barX, barY, 110, 13)
      ctx.fillStyle = team.baseHealth > 30 ? (teamId === localTeamId ? '#66d17a' : '#e85d75') : '#ff2d55'
      const healthWidth = 106 * Math.max(0, team.baseHealth / team.maxBaseHealth)
      ctx.fillRect(teamId === 'solar' ? barX + 2 : barX + 108 - healthWidth, barY + 2, healthWidth, 9)
    }

    const drawTowers = (now: number) => {
      for (const tower of snapshotRef.current.towers) {
        const point = cellCentre(tower.col, tower.row)
        const render = renderTowersRef.current.get(tower.id)
        const birth = render ? Math.min(1, (now - render.bornAt) / 340) : 1
        const birthScale = easeOutBack(birth)
        const pulse = render && render.pulseUntil > now ? 1 + Math.sin((render.pulseUntil - now) * 0.045) * 0.14 : 1
        ctx.fillStyle = 'rgba(0,0,0,.24)'
        ctx.beginPath(); ctx.ellipse(point.x + 3, point.y + 14, 22 * birthScale, 8 * birthScale, 0, 0, Math.PI * 2); ctx.fill()
        if (render && render.pulseUntil > now) {
          ctx.strokeStyle = TEAM_META[tower.teamId].colour; ctx.globalAlpha = (render.pulseUntil - now) / 520
          ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(point.x, point.y, 33 + (1 - (render.pulseUntil - now) / 520) * 20, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1
        }
        // The source turret art points left. Solar defends against monsters moving
        // right, so its turrets face right; lunar turrets retain the native direction.
        drawSprite(ctx, TOWER_META[tower.type].sprite, point.x, point.y, 56, tower.teamId !== localTeamId, tower.teamId === 'solar', 0, birthScale * pulse, birthScale / pulse)
        ctx.fillStyle = '#101614'
        const markerColumns = 4
        const markerSpacing = 5
        const markerStartX = point.x - ((markerColumns - 1) * markerSpacing) / 2
        const markerStartY = point.y + 7
        for (let level = 0; level < tower.level; level += 1) {
          ctx.beginPath()
          ctx.arc(markerStartX + (level % markerColumns) * markerSpacing, markerStartY + Math.floor(level / markerColumns) * markerSpacing, 1.8, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const drawUnits = (now: number, dt: number) => {
      const sinceSnapshot = Math.min(240, now - receivedAtRef.current) / 1000
      for (const render of renderUnitsRef.current.values()) {
        const unit = render.data
        const predictedX = unit.x + unit.vx * sinceSnapshot
        const predictedY = unit.y + unit.vy * sinceSnapshot
        const smoothing = 1 - Math.exp(-dt * 11)
        render.x += (predictedX - render.x) * smoothing
        render.y += (predictedY - render.y) * smoothing
        render.health += (unit.health - render.health) * (1 - Math.exp(-dt * 9))

        const phase = now * 0.009 + unit.id * 1.7
        const bob = Math.sin(phase) * 2.8
        const squash = 1 + Math.sin(phase * 2) * 0.035
        const size = unit.type === 'titan' ? 73 : unit.type === 'brute' ? 65 : unit.type === 'runner' ? 57 : 53
        const birth = Math.min(1, (now - render.bornAt) / 300)
        const state = now < render.hurtUntil ? 'hurt' : 'run'
        ctx.fillStyle = 'rgba(0,0,0,.3)'
        ctx.beginPath(); ctx.ellipse(render.x + 5, render.y + size * .29, size * .32, size * .105, 0, 0, Math.PI * 2); ctx.fill()
        drawSprite(ctx, monsterTexture(unit.type, state), render.x, render.y + bob, size, unit.teamId !== localTeamId, unit.teamId === 'lunar', Math.sin(phase * .5) * .025, easeOutBack(birth) * squash, easeOutBack(birth) / squash)
        const barWidth = size * .56
        ctx.fillStyle = 'rgba(12,20,15,.88)'; ctx.fillRect(render.x - barWidth / 2, render.y - size * .48, barWidth, 5)
        ctx.fillStyle = render.health / unit.maxHealth > .45 ? '#66d17a' : '#e85d75'; ctx.fillRect(render.x - barWidth / 2, render.y - size * .48, barWidth * Math.max(0, render.health / unit.maxHealth), 5)
      }
    }

    const drawProjectiles = (now: number) => {
      const age = Math.min(120, now - receivedAtRef.current) / 1000
      for (const projectile of snapshotRef.current.projectiles) {
        const x = projectile.x + projectile.vx * age
        const y = projectile.y + projectile.vy * age
        const angle = Math.atan2(projectile.vy, projectile.vx)
        const speed = Math.hypot(projectile.vx, projectile.vy) || 1
        const dirX = projectile.vx / speed
        const dirY = projectile.vy / speed
        ctx.save()
        if (projectile.teamId !== localTeamId) ctx.filter = 'invert(1)'
        if (projectile.type === 'missile') {
          ctx.translate(x, y); ctx.rotate(angle)
          ctx.fillStyle = '#bde0fe'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill()
        } else if (projectile.type === 'fragment') {
          const heat = Math.max(0, Math.min(1, projectile.lifeMs / projectile.maxLifeMs))
          const colour = heat > .72 ? '#fff' : heat > .44 ? '#ff8a16' : heat > .18 ? '#d82712' : '#0b0908'
          ctx.strokeStyle = colour; ctx.globalAlpha = .7; ctx.lineWidth = 2
          ctx.beginPath(); ctx.moveTo(projectile.previousX + projectile.vx * age, projectile.previousY + projectile.vy * age); ctx.lineTo(x, y); ctx.stroke()
          ctx.globalAlpha = 1; ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(x, y, projectile.radius * (.75 + heat * .55), 0, Math.PI * 2); ctx.fill()
        } else if (projectile.type === 'cluster') {
          ctx.fillStyle = 'rgba(241,91,181,.24)'; ctx.beginPath(); ctx.arc(x, y, projectile.radius * 2.2, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = '#ffc2f4'; ctx.beginPath(); ctx.arc(x, y, projectile.radius, 0, Math.PI * 2); ctx.fill()
        } else if (projectile.visualType === 'spray') {
          ctx.strokeStyle = 'rgba(66,245,255,.42)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - dirX * 18, y - dirY * 18); ctx.lineTo(x, y); ctx.stroke()
          ctx.translate(x, y); ctx.rotate(angle)
          ctx.fillStyle = 'rgba(255,79,216,.24)'; ctx.beginPath(); ctx.ellipse(0, 0, projectile.radius * 2.1, projectile.radius * 1.2, 0, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = '#e7ffff'; ctx.beginPath(); ctx.ellipse(0, 0, projectile.radius * 1.05, projectile.radius * .575, 0, 0, Math.PI * 2); ctx.fill()
        } else {
          ctx.strokeStyle = 'rgba(255,247,206,.64)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - dirX * 20, y - dirY * 20); ctx.lineTo(x, y); ctx.stroke()
          ctx.fillStyle = 'rgba(255,253,243,.28)'; ctx.beginPath(); ctx.arc(x, y, projectile.radius * 2.1, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = '#f7f0d6'; ctx.beginPath(); ctx.arc(x, y, projectile.radius, 0, Math.PI * 2); ctx.fill()
        }
        ctx.restore()
      }
    }

    const drawExplosions = () => {
      for (const explosion of snapshotRef.current.explosions) {
        const alpha = Math.max(0, Math.min(1, explosion.lifeMs / explosion.maxLifeMs))
        ctx.save()
        if (explosion.teamId !== localTeamId) ctx.filter = 'invert(1)'
        ctx.strokeStyle = `rgba(255,230,109,${alpha})`; ctx.lineWidth = 3
        ctx.beginPath(); ctx.arc(explosion.x, explosion.y, explosion.radius * (1.05 - alpha * .2), 0, Math.PI * 2); ctx.stroke()
        ctx.fillStyle = `rgba(255,159,28,${alpha * .16})`; ctx.beginPath(); ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      }
    }

    const drawEffects = (now: number) => {
      effectsRef.current = effectsRef.current.filter((effect) => now - effect.startedAt < effect.duration)
      for (const effect of effectsRef.current) {
        const t = (now - effect.startedAt) / effect.duration
        const alpha = 1 - t
        ctx.save(); ctx.globalAlpha = alpha
        if (effect.kind === 'impact') {
          ctx.strokeStyle = effect.colour; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(effect.x, effect.y, 5 + t * 28, 0, Math.PI * 2); ctx.stroke()
          ctx.fillStyle = '#fff0a8'; ctx.beginPath(); ctx.arc(effect.x, effect.y, 8 * (1 - t), 0, Math.PI * 2); ctx.fill()
        } else {
          for (let index = 0; index < 9; index += 1) {
            const angle = (index / 9) * Math.PI * 2 + effect.id
            const distance = t * (28 + (index % 3) * 11)
            ctx.fillStyle = index % 2 ? effect.colour : '#f7f0d6'
            ctx.beginPath(); ctx.arc(effect.x + Math.cos(angle) * distance, effect.y + Math.sin(angle) * distance - t * 12, 4 * alpha + 1, 0, Math.PI * 2); ctx.fill()
          }
          ctx.strokeStyle = effect.colour; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(effect.x, effect.y, 12 + t * 42, 0, Math.PI * 2); ctx.stroke()
        }
        ctx.restore()
      }
    }

    const drawHover = () => {
      const hover = hoverRef.current
      if (!hover) return
      const valid = isCellOnTeamSide(localTeamId, hover.col) && terrainAt(hover.col, hover.row) !== 'tree' && !isBaseFootprintCell(hover.col, hover.row)
      const occupied = snapshotRef.current.towers.some((tower) => tower.col === hover.col && tower.row === hover.row)
      const left = WORLD.mapLeft + hover.col * cellWidth
      const top = WORLD.mapTop + hover.row * cellHeight
      ctx.fillStyle = valid ? 'rgba(255,230,109,.12)' : 'rgba(232,93,117,.16)'; ctx.fillRect(left + 1, top + 1, cellWidth - 2, cellHeight - 2)
      ctx.strokeStyle = valid ? '#ffe66d' : '#e85d75'; ctx.lineWidth = 3; ctx.strokeRect(left + 2, top + 2, cellWidth - 4, cellHeight - 4)
      if (valid && !occupied) {
        const point = cellCentre(hover.col, hover.row)
        const towerType = selectedTowerRef.current
        drawSprite(ctx, TOWER_META[towerType].sprite, point.x, point.y, 54, false, localTeamId === 'solar', 0, 1, 1, .55)
        ctx.strokeStyle = TOWER_META[towerType].colour; ctx.globalAlpha = .22; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(point.x, point.y, getTowerStats({ type: towerType, level: 1 }).range, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1
      }
    }

    const render = (now: number) => {
      if (cancelled) return
      const dt = Math.min(.05, (now - previousTime) / 1000)
      previousTime = now
      syncRenderState(now)
      const projectileAge = Math.min(120, now - receivedAtRef.current) / 1000
      projectileEffects.emitTrails(snapshotRef.current.projectiles, dt * 1000, projectileAge)
      projectileEffects.update(dt * 1000)
      ctx.clearRect(0, 0, WORLD.width, WORLD.height)
      ctx.drawImage(staticLayer, 0, 0)
      drawBase('solar', now); drawBase('lunar', now)
      drawTowers(now)
      projectileEffects.render(ctx, localTeamId)
      drawProjectiles(now)
      drawUnits(now, dt)
      drawExplosions()
      drawEffects(now)
      drawHover()
      if (snapshotRef.current.status === 'ended') {
        ctx.fillStyle = 'rgba(5,12,9,.66)'; ctx.fillRect(0, 0, WORLD.width, WORLD.height)
        ctx.fillStyle = snapshotRef.current.winner === localTeamId ? '#ffe66d' : '#f7f0d6'; ctx.font = '900 70px Nunito, sans-serif'; ctx.textAlign = 'center'
        ctx.fillText(snapshotRef.current.winner === localTeamId ? 'VICTORY!' : 'BATTLE LOST', WORLD.width / 2, WORLD.height / 2)
      }
      frame = requestAnimationFrame(render)
    }

    Promise.all([...terrainSources, ...dynamicSources].map(waitForImage)).then(() => {
      if (cancelled) return
      buildStaticLayer()
      frame = requestAnimationFrame(render)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [localTeamId])

  const pointerToCell = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) * (WORLD.width / rect.width)
    const y = (event.clientY - rect.top) * (WORLD.height / rect.height)
    if (x < WORLD.mapLeft || x >= WORLD.mapRight || y < WORLD.mapTop || y >= WORLD.mapBottom) return null
    return { col: Math.floor((x - WORLD.mapLeft) / cellWidth), row: Math.floor((y - WORLD.mapTop) / cellHeight) }
  }

  return (
    <canvas
      ref={canvasRef}
      className="battle-canvas"
      aria-label="Arithmetic Annihilation battlefield"
      onPointerMove={(event) => { hoverRef.current = pointerToCell(event) }}
      onPointerLeave={() => { hoverRef.current = null }}
      onClick={(event) => {
        const cell = pointerToCell(event)
        if (cell) onGridClick(cell.col, cell.row)
      }}
    />
  )
}
