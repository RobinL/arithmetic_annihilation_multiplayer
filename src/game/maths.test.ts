import { describe, expect, it } from 'vitest'
import { DEFAULT_MATHS_LEVEL, MathsQuestionGenerator, mapChallengeToYearLevel } from './maths'

describe('reference maths question generation', () => {
  it('uses Year 2 as the requested base difficulty', () => {
    expect(DEFAULT_MATHS_LEVEL).toBe('year2')
    expect(mapChallengeToYearLevel()).toBe('year2')
  })

  it('maps the four challenge bands with the reference year offsets', () => {
    expect(mapChallengeToYearLevel('year2', 0)).toBe('year2')
    expect(mapChallengeToYearLevel('year2', 1)).toBe('year3')
    expect(mapChallengeToYearLevel('year2', 2)).toBe('year4')
    expect(mapChallengeToYearLevel('year2', 3)).toBe('year5')
    expect(mapChallengeToYearLevel('year5', 3)).toBe('year6')
  })

  it('uses the package expression, answer and four-choice format', () => {
    const generator = new MathsQuestionGenerator('test-seed')
    const question = generator.createQuestion('year2', 0)
    expect(question.levelLabel).toBe('Year 2')
    expect(question.choices).toHaveLength(4)
    expect(question.choices).toContain(question.answer)
    expect(question.prompt.length).toBeGreaterThan(0)
  })
})
