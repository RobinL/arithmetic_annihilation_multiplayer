import { useState } from 'react'
import type { MathsQuestion } from '../game/types'
import { assetUrl } from '../game/config'

interface Props {
  title: string
  question: MathsQuestion
  onCorrect: () => void
  onCancel: () => void
}

export function MathsModal({ title, question, onCorrect, onCancel }: Props) {
  const [wrong, setWrong] = useState(false)

  const answer = (choice: string) => {
    if (choice === question.answer) {
      new Audio(assetUrl('audio/pop.mp3')).play().catch(() => undefined)
      onCorrect()
    } else {
      setWrong(true)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="maths-modal" role="dialog" aria-modal="true" aria-labelledby="question-title">
        <button className="modal-close" onClick={onCancel} aria-label="Close question">×</button>
        <p className="eyebrow">{question.levelLabel} challenge</p>
        <h2 id="question-title">{title}</h2>
        <p className="question-prompt">{question.prompt} <span>= ?</span></p>
        <div className="answer-grid">
          {question.choices.map((choice) => (
            <button key={choice} onClick={() => answer(choice)}>{choice}</button>
          ))}
        </div>
        <p className={wrong ? 'answer-feedback is-wrong' : 'answer-feedback'}>
          {wrong ? `Not quite. The answer is ${question.answer} — choose it to continue.` : 'Pick the correct answer to complete your move.'}
        </p>
      </section>
    </div>
  )
}
