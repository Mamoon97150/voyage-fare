import { formatMoney } from '../../lib/money'
import { roomsTotal, type RoomDraft } from '../../lib/rooms'
import type { Traveller } from '../../lib/trips'

/**
 * A stay by room (SR-4, mockup rooms-v4): each room its name, its price and who sleeps there.
 * The stay's price is the rooms added up; each room is split between its occupants.
 */
export function RoomsEditor({
  id,
  rooms,
  onRooms,
  travellers,
  currency,
  error,
}: {
  id: string
  rooms: RoomDraft[]
  onRooms: (rooms: RoomDraft[]) => void
  travellers: Traveller[]
  currency: string
  error?: string
}) {
  const set = (i: number, change: Partial<RoomDraft>) => onRooms(rooms.map((r, j) => (j === i ? { ...r, ...change } : r)))
  const total = roomsTotal(rooms)
  return (
    <div className="rooms">
      {rooms.map((room, i) => (
        <div key={i} className="room" role="group" aria-label={room.name || `Room ${i + 1}`}>
          <div className="room__row">
            <div className="field">
              <label htmlFor={`${id}-room-${i}`} className="field__label">
                Room
              </label>
              <input id={`${id}-room-${i}`} className="field__input" value={room.name} onChange={(e) => set(i, { name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`${id}-room-${i}-price`} className="field__label">
                Price
              </label>
              <div className="field__box">
                <input
                  id={`${id}-room-${i}-price`}
                  className="field__input num"
                  inputMode="decimal"
                  value={room.price}
                  onChange={(e) => set(i, { price: e.target.value })}
                />
                <span className="field__unit">{currency}</span>
              </div>
            </div>
          </div>
          <span className="field__label">Who sleeps here</span>
          <div className="who-for__names">
            {travellers.map((t) => {
              const on = room.occupants.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  aria-label={`${t.name} sleeps in ${room.name || `room ${i + 1}`}`}
                  onClick={() => set(i, { occupants: on ? room.occupants.filter((x) => x !== t.id) : [...room.occupants, t.id] })}
                >
                  {t.name}
                </button>
              )
            })}
          </div>
          {rooms.length > 1 && (
            <button type="button" className="link-button room__remove" onClick={() => onRooms(rooms.filter((_, j) => j !== i))}>
              Remove this room
            </button>
          )}
        </div>
      ))}
      <button type="button" className="add-row" onClick={() => onRooms([...rooms, { name: `Room ${rooms.length + 1}`, price: '', occupants: [] }])}>
        <span className="add-row__plus" aria-hidden="true">
          +
        </span>
        Add a room
      </button>
      {error && <p className="field__error">{error}</p>}
      <p className="rooms__total num">
        <span>
          The stay, {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
        </span>
        <b>{total === null ? '—' : formatMoney(total, currency)}</b>
      </p>
      <p className="field__hint">A room with nobody in it is split between everyone on the stay.</p>
    </div>
  )
}
