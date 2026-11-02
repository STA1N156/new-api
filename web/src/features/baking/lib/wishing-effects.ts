/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import i18next from 'i18next'

import '@/styles/baking-jackpot.css'

export const WISHING_REVEAL_MS = 6200

interface CookiePosition {
  x: number
  y: number
  size: number
  height: number
}

// Only the seventh-level win uses this scene. All motion stays inside
// the existing effects portal, so scrolling and unmount cleanup still work.
export async function playWishingJackpot(
  root: HTMLElement,
  portal: HTMLElement,
  start: CookiePosition,
  end: CookiePosition,
  rewardCookies: number
) {
  const svg = root.querySelector('#oven-cookie svg')?.cloneNode(true) as
    | SVGElement
    | undefined
  if (!svg) return
  const mobile = innerWidth < 680
  const radius = Math.min(mobile ? 140 : 190, root.clientWidth * 0.38)
  const lift = mobile ? 64 : 76
  const scene = document.createElement('div')
  scene.className = 'wishing-jackpot'
  scene.style.left = `${end.x}px`
  scene.style.top = `${end.y}px`
  portal.append(scene)
  const jobs: Promise<void>[] = []
  const colors = ['#edc769', '#f8e7bc', '#a7c5b8', '#d6b3c2', '#b9b5dc']
  const move = (x: number, y: number, scale = 1, angle = 0) =>
    `translate3d(${x}px,${y}px,0) scale(${scale}) rotate(${angle}deg)`

  function piece(name: string, width: number, height = width) {
    const node = document.createElement('div')
    node.className = `wish-${name}`
    Object.assign(node.style, {
      width: `${width}px`,
      height: `${height}px`,
      left: `${-width / 2}px`,
      top: `${-height / 2}px`,
    })
    scene.append(node)
    return node
  }
  function animate(
    node: HTMLElement,
    frames: Keyframe[],
    duration: number,
    delay = 0
  ) {
    const finished = node
      .animate(frames, {
        duration,
        delay,
        fill: 'both',
        easing: 'cubic-bezier(.22,.7,.24,1)',
      })
      .finished.then(
        () => {},
        () => {}
      )
      .finally(() => node.remove())
    jobs.push(finished)
    return finished
  }

  // Dim the surrounding activity while keeping the lifted cookie in a spotlight.
  const focus = piece('focus', root.clientWidth, root.clientHeight)
  Object.assign(focus.style, { left: `${-end.x}px`, top: `${-end.y}px` })
  focus.style.setProperty('--wish-focus-x', `${end.x}px`)
  focus.style.setProperty('--wish-focus-y', `${end.y - lift}px`)
  animate(
    focus,
    [
      { opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { opacity: 1, offset: 0.78 },
      { opacity: 0 },
    ],
    WISHING_REVEAL_MS
  )

  animate(
    piece('aura', radius * 2.9),
    [
      { transform: move(0, -lift, 0.4), opacity: 0 },
      { transform: move(0, -lift, 0.65), opacity: 0.7, offset: 0.08 },
      { transform: move(0, -lift, 1), opacity: 1, offset: 0.2 },
      { transform: move(0, -lift, 1.06), opacity: 0.85, offset: 0.78 },
      { transform: move(0, -lift, 1.2), opacity: 0 },
    ],
    WISHING_REVEAL_MS
  )
  animate(
    piece('halo', radius * 2.2),
    [
      { transform: move(0, -lift, 0.3, -35), opacity: 0 },
      { transform: move(0, -lift, 1, 0), opacity: 0.95, offset: 0.14 },
      { transform: move(0, -lift, 1.12, 110), opacity: 0.75, offset: 0.8 },
      { transform: move(0, -lift, 1.2, 140), opacity: 0 },
    ],
    5600,
    480
  )

  for (let i = 0; i < (mobile ? 12 : 18); i++) {
    const angle = (i * Math.PI * 2) / (mobile ? 12 : 18)
    const star = piece('star', 5 + (i % 3) * 2)
    star.style.background = colors[i % colors.length]
    animate(
      star,
      [
        {
          transform: move(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius - lift,
            0.3
          ),
          opacity: 0,
        },
        {
          transform: move(
            Math.cos(angle + 0.35) * radius * 0.65,
            Math.sin(angle + 0.35) * radius * 0.65 - lift
          ),
          opacity: 1,
          offset: 0.4,
        },
        { transform: move(0, -lift, 0.15, 140), opacity: 0 },
      ],
      780,
      (i % 3) * 25
    )
  }

  for (let i = 0; i < 6; i++) {
    const ring = piece(
      i % 3 === 1 ? 'orbit' : 'ring',
      radius * (1.3 + (i % 3) * 0.22)
    )
    animate(
      ring,
      [
        { transform: move(0, -lift, 0.15, -22), opacity: 0 },
        { transform: move(0, -lift, 0.88, -10), opacity: 1, offset: 0.2 },
        { transform: move(0, -lift, 1.12, 35), opacity: 0.7, offset: 0.7 },
        { transform: move(0, -lift, 1.4, 65), opacity: 0 },
      ],
      2800,
      700 + i * 420
    )
  }

  // Slow revolving stars keep the suspended cookie alive during the long hold.
  const satelliteCount = mobile ? 8 : 12
  for (let i = 0; i < satelliteCount; i++) {
    const star = piece('star', i % 3 === 0 ? 16 : 9)
    star.style.background = colors[i % colors.length]
    animate(
      star,
      Array.from({ length: 49 }, (_, step) => {
        const progress = step / 48
        const angle =
          (i / satelliteCount) * Math.PI * 2 + progress * Math.PI * 1.5
        return {
          offset: progress,
          transform: move(
            Math.cos(angle) * radius * 0.68,
            Math.sin(angle) * radius * 0.52 - lift,
            0.85 + Math.sin(progress * Math.PI) * 0.3,
            progress * 160
          ),
          opacity: Math.min(1, progress * 8, (1 - progress) * 6),
        }
      }),
      4500,
      950
    )
  }

  // Two outward launch points shower stars and ribbons along curved paths.
  const particleCount = mobile ? 60 : 108
  for (let i = 0; i < particleCount; i++) {
    const side = i % 2 ? 1 : -1
    const x = side * radius * 0.9
    const peakX = (Math.random() - 0.5) * radius * 2.4
    const peakY = -lift - 70 - Math.random() * radius * 1.2
    const size = 5 + Math.random() * 6
    const star = i % 3 === 0
    const particle = piece(
      star ? 'star' : 'ribbon',
      size,
      star ? size : size * 1.9
    )
    particle.style.background = colors[i % colors.length]
    animate(
      particle,
      [
        { transform: move(x, 45, 0.4), opacity: 0 },
        {
          transform: move(x * 0.7, -35, 1, side * 70),
          opacity: 1,
          offset: 0.12,
        },
        {
          transform: move(peakX, peakY, 1, side * 170),
          opacity: 0.95,
          offset: 0.4,
        },
        {
          transform: move(peakX + side * 35, 70, 0.8, side * 330),
          opacity: 0.7,
          offset: 0.8,
        },
        {
          transform: move(peakX + side * 48, 160, 0.4, side * 430),
          opacity: 0,
        },
      ],
      3300 + Math.random() * 1100,
      850 + Math.floor(i / (particleCount / 3)) * 1350 + Math.random() * 180
    )
  }

  for (let i = 0; i < (mobile ? 6 : 12); i++) {
    const x = ((i % 3) - 1) * radius * 0.7
    animate(
      piece('comet', 65 + (i % 3) * 15, 2),
      [
        { transform: move(x + 110, -radius - 60, 0.5, -38), opacity: 0 },
        { transform: move(x + 25, -85, 1, -38), opacity: 0.9, offset: 0.4 },
        { transform: move(x - 110, 50, 0.7, -38), opacity: 0 },
      ],
      1450,
      1100 + i * 330
    )
  }

  const title = piece('prize', 220, 36)
  const name = document.createElement('span')
  name.textContent = i18next.t('Wishing Cookie', { lng: 'zhCN' })
  title.append(name)
  const reward = piece('prize', 220, 44)
  const amount = document.createElement('strong')
  amount.textContent = `${rewardCookies}🍪`
  reward.append(amount)
  const cookieRadius = (end.size * 1.55) / 2
  for (const { node, y } of [
    { node: title, y: -lift + cookieRadius + 30 },
    { node: reward, y: -lift + cookieRadius + 70 },
  ]) {
    animate(
      node,
      [
        { transform: move(0, y + 12, 0.9), opacity: 0 },
        { transform: move(0, y + 12, 0.9), opacity: 0, offset: 0.15 },
        { transform: move(0, y), opacity: 1, offset: 0.24 },
        { transform: move(0, y), opacity: 1, offset: 0.7 },
        { transform: move(0, y - 8, 1.02), opacity: 0, offset: 0.78 },
        { transform: move(0, y - 8, 1.02), opacity: 0 },
      ],
      WISHING_REVEAL_MS
    )
  }

  const cookie = piece('cookie', end.size, end.height)
  svg.setAttribute('preserveAspectRatio', 'none')
  cookie.append(svg)
  const roundScale = end.size / end.height
  const flight = animate(
    cookie,
    [
      {
        transform: `translate3d(${start.x - end.x}px,${start.y - end.y}px,0) scale(${start.size / end.size},${start.height / end.height})`,
      },
      {
        transform: 'translate3d(0,-8px,0) scale(.9) rotate(-3deg)',
        offset: 0.085,
      },
      {
        transform: `translate3d(0,${-lift}px,0) scale(1.55,${1.55 * roundScale}) rotate(2deg)`,
        offset: 0.22,
      },
      {
        transform: `translate3d(0,${-lift - 4}px,0) scale(1.55,${1.55 * roundScale}) rotate(-1deg)`,
        offset: 0.4,
      },
      {
        transform: `translate3d(0,${-lift + 3}px,0) scale(1.55,${1.55 * roundScale}) rotate(1deg)`,
        offset: 0.6,
      },
      {
        transform: `translate3d(0,${-lift}px,0) scale(1.55,${1.55 * roundScale}) rotate(0deg)`,
        offset: 0.78,
      },
      { transform: 'translate3d(0,0,0) scale(1) rotate(0deg)', offset: 0.94 },
      { transform: 'translate3d(0,0,0) scale(1) rotate(0deg)' },
    ],
    WISHING_REVEAL_MS
  )

  // Hold the spotlight through the return; the final confetti can finish afterward.
  void Promise.all(jobs).finally(() => scene.remove())
  await flight
}
