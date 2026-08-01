import { describe, expect, it, vi } from 'vitest'
import { CanvasProjectileEffects } from './canvasProjectileEffects'

describe('CanvasProjectileEffects', () => {
  it('batches the opposing team under a single inverted canvas state', () => {
    const effects = new CanvasProjectileEffects()
    effects.spawnExplosion('solar', 100, 100, 20)
    effects.spawnExplosion('lunar', 200, 100, 20)

    let filterAssignments = 0
    let filter = 'none'
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
      set filter(value: string) {
        filterAssignments += 1
        filter = value
      },
      get filter() {
        return filter
      },
    } as unknown as CanvasRenderingContext2D

    effects.render(context, 'solar')

    expect(context.fill).toHaveBeenCalled()
    expect(context.save).toHaveBeenCalledTimes(1)
    expect(context.restore).toHaveBeenCalledTimes(1)
    expect(filterAssignments).toBe(1)
    expect(filter).toBe('invert(1)')
  })
})
