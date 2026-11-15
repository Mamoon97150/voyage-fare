import { describe, expect, it } from 'vitest'
import { AI_REQUEST, findJson, parseAiAnswer, planImport, sameName } from './aiImport'

const plain = (s: string) => s.replace(/[  ]/g, ' ')

const answer = (json: string, around = true) =>
  around ? `Here's your trip! 🎌\n\n\`\`\`json\n${json}\n\`\`\`\n\nHave a great time!` : json

const japan = `{
  "voyage_fare": 1,
  "trip": { "name": "Japan in spring", "start": "2027-04-02", "end": "2027-04-12", "from": "Paris", "currency": "EUR", "travellers": ["Ana", "Bea"] },
  "tickets": [ { "from": "Paris", "to": "Tokyo", "mode": "plane", "day": 1, "options": [ { "name": "Air France", "price": 890, "currency": "EUR", "per": "total" } ] } ],
  "places": [
    { "name": "Tokyo", "nights": 4, "lines": [
      { "type": "stay", "name": "Where we sleep", "options": [ { "name": "Hotel Gracery", "price": 160, "currency": "EUR", "per": "night", "link": "https://gracery.test/a//b" } ] },
      { "type": "activity", "name": "teamLab Planets", "day": 2, "options": [ { "price": 5200, "currency": "JPY", "per": "person" } ] },
      { "type": "activity", "name": "Day in Nikko", "day": 3 }, // no price yet
    ] },
    { "name": "Kyoto", "nights": 3, "lines": [
      { "type": "stay", "name": "Ryokan or hotel?", "options": [ { "name": "Ryokan Yachiyo", "price": 780 }, { "name": "Hotel Kanra", "price": 450 } ] },
      { "type": "food", "name": "Kikunoi", "day": null, "note": "kaiseki", "options": [ { "price": 360 } ] },
      { "type": "activity", "name": "Hotel ???", "options": [ { "price": "about 100" } ] },
      { "type": "activity", "options": [] }
    ] }
  ]
}`

describe('reading the answer', () => {
  it('finds the JSON in the text around it, with comments and trailing commas', () => {
    expect(findJson('Sure! {"a": 1, // one\n "b": "https://x.test/y",}\nEnjoy')).toEqual({
      a: 1,
      b: 'https://x.test/y',
    })
    expect(findJson('No trip here, sorry.')).toBeNull()
  })

  it('the request’s own example reads back (any AI copying it gives something we can read)', () => {
    const parsed = parseAiAnswer(AI_REQUEST)
    expect(parsed?.trip.name).toBe('Japan in spring')
    expect(parsed?.places[0].lines.map((l) => l.kind)).toEqual(['housing', 'activity', 'restaurant'])
  })

  it('the trip, places, lines and tickets; unreadable lines left out, saying why', () => {
    const parsed = parseAiAnswer(answer(japan))!
    expect(parsed.trip).toEqual({
      name: 'Japan in spring',
      start: '2027-04-02',
      end: '2027-04-12',
      from: 'Paris',
      currency: 'EUR',
      travellers: ['Ana', 'Bea'],
    })
    expect(parsed.places.map((p) => [p.name, p.nights, p.lines.length])).toEqual([
      ['Tokyo', 4, 3],
      ['Kyoto', 3, 2],
    ])
    expect(parsed.places[0].lines[0].options[0].link).toBe('https://gracery.test/a//b')
    expect(parsed.tickets[0]).toMatchObject({ from: 'Paris', to: 'Tokyo', mode: 'plane', day: 1 })
    expect(parsed.skipped).toEqual([
      { what: 'Kyoto: Hotel ???', why: 'its price isn’t a number' },
      { what: 'Kyoto: a line', why: 'it has no name' },
    ])
  })

  it('no trip in the answer: null', () => {
    expect(parseAiAnswer('I planned a lovely trip to Japan for you, with Tokyo and Kyoto.')).toBeNull()
    expect(parseAiAnswer('{"hello": "world"}')).toBeNull()
  })

  it('names compared without case or accents', () => {
    expect(sameName('Évora', ' evora ')).toBe(true)
  })
})

describe('the preview', () => {
  const parsed = () => parseAiAnswer(answer(japan))!

  it('a new trip: per night and per person worked out, other currencies at today’s rate, each person’s part', () => {
    const p = planImport(parsed(), null, 'EUR', 2, { JPY: 0.0062 })
    expect(p.newPlaces).toBe(2)
    expect(p.newLines).toBe(6) // 3 + 2 lines, 1 ticket
    const tokyo = p.places[0].lines.map((l) => [l.when, l.name, plain(l.price), l.sub && plain(l.sub)])
    expect(tokyo).toEqual([
      ['Stay', 'Where we sleep: Hotel Gracery', '640 €', '4 nights × 160 €'],
      ['Day 2', 'teamLab Planets', '64 €', '2 people × 5 200 JPY'],
      ['Day 3', 'Day in Nikko', '—', 'no price: shows a dash until you add one'],
    ])
    const kyoto = p.places[1].lines.map((l) => [l.when, l.name, plain(l.price)])
    expect(kyoto).toEqual([
      ['Stay', 'Ryokan or hotel?', 'from 450 €'],
      ['To try', 'Kikunoi', '≈ 180 € each'],
    ])
    // 890 + 640 + 64 (Kyoto's stay waits for a choice, To try doesn't count) ÷ 2
    expect(p.each).toBe(797)
    expect(p.notes[0]).toBe(
      'Prices in JPY are saved with today’s rate (1 JPY = 0.0062 EUR). You can change it on the line.',
    )
    // The payload: totals in their own currency, with the rate.
    expect(p.payload.places[0].lines[1].options[0]).toMatchObject({ amount: 10400, currency: 'JPY', rate: 0.0062 })
    expect(p.payload.tickets[0]).toMatchObject({ from: 'Paris', after_place: null, after_new: null })
  })

  it('no rate for a currency: said, so the page can wait', () => {
    expect(planImport(parsed(), null, 'EUR', 2, {}).missingRates).toEqual(['JPY'])
  })

  it('adding to a trip: places matched by name, lines already there kept, new places at the end', () => {
    const target = {
      travellers: [],
      places: [{ id: 'tok', name: 'tokyo', nights: 5, position: 1 }],
      items: [{ id: 'x', place_id: 'tok', name: 'TEAMLAB planets' }],
      legs: [{ from_name: 'Paris', to_name: 'Tokyo' }],
    } as never
    const p = planImport(parsed(), target, 'EUR', 2, { JPY: 0.0062 })
    expect(p.places.map((x) => [x.name, x.isNew])).toEqual([
      ['tokyo', false],
      ['Kyoto', true],
    ])
    expect(p.places[0].lines.find((l) => l.name === 'teamLab Planets')?.there).toBe(true)
    expect(p.tickets[0].there).toBe(true)
    expect(p.newPlaces).toBe(1)
    expect(p.newLines).toBe(4) // Tokyo: stay + Nikko; Kyoto: 2
    // Tokyo keeps its own nights (5): the stay is 5 × 160.
    expect(p.payload.places[0]).toMatchObject({
      id: 'tok',
      lines: [{ name: 'Where we sleep' }, { name: 'Day in Nikko' }],
    })
    expect(p.payload.places[0].lines[0].options[0].amount).toBe(800)
    expect(p.payload.tickets).toEqual([])
    expect(p.notes).toContain('Kyoto goes at the end of the route: move it if it’s not the right order.')
    expect(p.notes).toContain(
      '2 lines already there are left as they are (yours wins): teamLab Planets, Paris → Tokyo: Air France.',
    )
  })
})
