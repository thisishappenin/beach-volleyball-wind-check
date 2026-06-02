import { useState } from 'react'
import { X } from 'lucide-react'

function dayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function RatingModal({ location, date, slot, modelScore, existing, onSave, onClose }) {
  const [rating, setRating] = useState(existing?.rating ?? null)
  const [wouldPlay, setWouldPlay] = useState(existing?.would_play ?? null)

  const canSave = rating !== null && wouldPlay !== null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">Log conditions</h2>
            <p className="text-sm text-slate-600 mt-0.5">{location.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {dayLabel(date)} · {slot === 'morning' ? '8–11 AM' : '4–7 PM'}
              {modelScore != null && <span className="ml-2 text-slate-300">·</span>}
              {modelScore != null && <span className="ml-2">Model: {modelScore}/10</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-300 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Condition rating */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2.5">How were the conditions?</p>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className={`py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  rating === n
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1.5 px-0.5">
            <span>Unplayable</span>
            <span>Perfect</span>
          </div>
        </div>

        {/* Would play again */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2.5">Would you play in these conditions again?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setWouldPlay(true)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                wouldPlay === true
                  ? 'bg-green-50 text-green-800 border-green-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => setWouldPlay(false)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                wouldPlay === false
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              No
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => canSave && onSave(rating, wouldPlay)}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
