import { generateProblem, getYearLevels } from 'maths-game-problem-generator'
import type { MathsLevel, MathsQuestion } from './types'

export const MATHS_LEVELS: { value: MathsLevel; label: string; note: string }[] = [
  { value: 'reception', label: 'Reception', note: 'Numbers to 10' },
  { value: 'year1', label: 'Year 1', note: 'Numbers to 20' },
  { value: 'year2', label: 'Year 2', note: 'Numbers to 100' },
  { value: 'year3', label: 'Year 3', note: 'Times tables begin' },
  { value: 'year4', label: 'Year 4', note: 'All four operations' },
  { value: 'year5', label: 'Year 5', note: 'Larger numbers' },
  { value: 'year6', label: 'Year 6', note: 'Advanced arithmetic' },
]

export const DEFAULT_MATHS_LEVEL: MathsLevel = 'year2'
export const BASE_MATHS_DIFFICULTIES = getYearLevels() as readonly MathsLevel[]

const DIFFICULTY_OFFSETS = [0, 1, 2, 3] as const

export function mapChallengeToYearLevel(baseLevel: MathsLevel = DEFAULT_MATHS_LEVEL, challenge = 0): MathsLevel {
  const baseIndex = BASE_MATHS_DIFFICULTIES.indexOf(baseLevel)
  const offset = DIFFICULTY_OFFSETS[Math.max(0, Math.min(3, challenge))]
  return BASE_MATHS_DIFFICULTIES[Math.min(BASE_MATHS_DIFFICULTIES.length - 1, baseIndex + offset)]
}

class SeededRandom {
  private state: number

  constructor(seed: string) {
    let hash = 2166136261
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    this.state = hash >>> 0 || 0x6d2b79f5
  }

  next() {
    this.state += 0x6d2b79f5
    let value = this.state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  shuffle<T>(items: readonly T[]) {
    const copy = [...items]
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.next() * (index + 1))
      ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
    }
    return copy
  }
}

/** Mirrors the reference MathsQuestionSystem, with the requested Year 2 base default. */
export class MathsQuestionGenerator {
  private lastExpression: string | undefined
  private readonly rng: SeededRandom

  constructor(seed: string) {
    this.rng = new SeededRandom(seed)
  }

  createQuestion(baseLevel: MathsLevel = DEFAULT_MATHS_LEVEL, challenge = 0): MathsQuestion {
    const yearLevel = mapChallengeToYearLevel(baseLevel, challenge)
    let problem = generateProblem({ yearLevel, multipleChoice: true, choiceCount: 4 })
    for (let attempt = 0; attempt < 4 && problem.expression === this.lastExpression; attempt += 1) {
      problem = generateProblem({ yearLevel, multipleChoice: true, choiceCount: 4 })
    }
    this.lastExpression = problem.expression
    return {
      prompt: problem.expression,
      answer: problem.correctChoice,
      choices: this.rng.shuffle(problem.choices),
      levelLabel: MATHS_LEVELS.find((level) => level.value === yearLevel)?.label ?? yearLevel,
    }
  }
}
