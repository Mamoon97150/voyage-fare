// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isPrivateAddress, mapsSpot, readPage } from '../../supabase/functions/link-preview/read'

// Paste a link → option (build 9, mockup maps-v6): only what the page publishes for previews.
describe('reading a page', () => {
  it('Open Graph: the name without the site, the picture, the price with its currency', () => {
    const html = `<html><head>
      <meta property="og:title" content="Quiet flat near Shibuya &amp; park - Airbnb">
      <meta property="og:site_name" content="Airbnb">
      <meta content="https://a0.muscache.com/im/pictures/x.jpg" property="og:image">
      <meta property="product:price:amount" content="135">
      <meta property="product:price:currency" content="eur">
      <meta property="place:location:latitude" content="35.66">
      <meta property="place:location:longitude" content="139.70">
    </head></html>`
    expect(readPage(html, 'https://www.airbnb.com/rooms/1')).toEqual({
      name: 'Quiet flat near Shibuya & park',
      image: 'https://a0.muscache.com/im/pictures/x.jpg',
      site: 'Airbnb',
      price: 135,
      currency: 'EUR',
      place: null,
      latitude: 35.66,
      longitude: 139.7,
      url: 'https://www.airbnb.com/rooms/1',
    })
  })

  it('JSON-LD for a hotel: its name, place and spot; a price with no currency is dropped', () => {
    const html = `<script type="application/ld+json">{"@graph":[{"@type":"WebPage"},{"@type":"Hotel","name":"Hotel Gracery Shinjuku",
      "image":["/img/a.jpg"],"address":{"addressLocality":"Shinjuku"},"geo":{"latitude":"35.6948","longitude":"139.7020"},
      "offers":{"price":"135"}}]}</script><title>Gracery | Booking.com</title>`
    expect(readPage(html, 'https://www.booking.com/hotel/jp/gracery.html')).toMatchObject({
      name: 'Hotel Gracery Shinjuku',
      image: 'https://www.booking.com/img/a.jpg',
      site: 'booking.com',
      price: null,
      currency: null,
      place: 'Shinjuku',
      latitude: 35.6948,
      longitude: 139.702,
    })
  })

  it('nothing on the page: nothing made up', () => {
    expect(readPage('<html></html>', 'https://example.com/x')).toMatchObject({
      name: null,
      image: null,
      price: null,
      latitude: null,
    })
  })

  it('a Google Maps address carries its name and spot', () => {
    expect(mapsSpot('https://www.google.com/maps/place/Kikunoi/@35.001,135.781,17z')).toEqual({
      name: 'Kikunoi',
      latitude: 35.001,
      longitude: 135.781,
    })
  })

  it('never reads private addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '192.168.1.19',
      '172.20.0.1',
      '169.254.169.254',
      '::1',
      'fd00::1',
      '::ffff:10.0.0.1',
    ])
      expect(isPrivateAddress(ip)).toBe(true)
    for (const ok of ['8.8.8.8', '2606:4700::1111', 'fdj.fr', 'booking.com']) expect(isPrivateAddress(ok)).toBe(false)
  })
})
