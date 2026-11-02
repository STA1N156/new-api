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
import { BAKING_FX_COLORS } from '../constants'
import { playWishingJackpot } from './wishing-effects'

const COOKIE_ANIMATION_MS = 800

interface Origin {
  x: number
  y: number
  size: number
  height: number
}
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  gravity: number
  size: number
  turn: number
  spin: number
  life: number
  color: string
  shape: 'dot' | 'paper' | 'star' | 'ribbon'
  delay: number
}

export class BakingEffects {
  private portal = document.createElement('div')
  private canvas = document.createElement('canvas')
  private context: CanvasRenderingContext2D | null
  private particles: Particle[] = []
  private frame = 0
  private lastTime = 0
  private disposed = false
  private bankPulse?: Animation
  private observer: ResizeObserver
  private width = 0
  private height = 0

  constructor(private root: HTMLElement) {
    this.portal.className = 'baking-activity baking-effects'
    this.portal.setAttribute('aria-hidden', 'true')
    this.canvas.id = 'fx-canvas'
    this.portal.append(this.canvas)
    this.root.append(this.portal)
    this.context = this.canvas.getContext('2d')
    this.resize()
    this.observer = new ResizeObserver(this.resize)
    this.observer.observe(this.root)
    window.addEventListener('resize', this.resize)
  }

  private reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  private resize = () => {
    const scale = Math.min(devicePixelRatio || 1, 1.25)
    this.width = this.root.clientWidth
    this.height = this.root.clientHeight
    this.canvas.width = Math.round(this.width * scale)
    this.canvas.height = Math.round(this.height * scale)
    this.context?.setTransform(scale, 0, 0, scale, 0, 0)
  }

  origin(): Origin | undefined {
    const rect = this.root
      .querySelector<HTMLElement>('#oven-cookie')
      ?.getBoundingClientRect()
    if (!rect) return
    const bounds = this.portal.getBoundingClientRect()
    return {
      x: rect.x + rect.width / 2 - bounds.x,
      y: rect.y + rect.height / 2 - bounds.y,
      size: rect.width,
      height: rect.height,
    }
  }

  reveal(hidden: boolean) {
    // React updates the stage class during an upgrade; keep visibility separate.
    this.root.toggleAttribute('data-cookie-reveal', hidden)
  }

  private node(className: string, x: number, y: number, size: number) {
    const node = document.createElement('div')
    node.className = className
    Object.assign(node.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
    })
    if (className === 'fx-cookie') {
      const svg = this.root
        .querySelector('#oven-cookie svg')
        ?.cloneNode(true) as SVGElement | undefined
      if (svg) {
        svg.setAttribute('preserveAspectRatio', 'none')
        node.append(svg)
      }
    }
    this.portal.append(node)
    return node
  }

  private animate(
    node: HTMLElement,
    frames: Keyframe[],
    options: KeyframeAnimationOptions
  ) {
    return node
      .animate(frames, options)
      .finished.catch(() => {})
      .finally(() => node.remove())
  }

  private draw = (time: number) => {
    if (this.disposed || !this.context) return
    const delta = Math.min((time - this.lastTime) / 1000 || 0.016, 0.04)
    this.lastTime = time
    this.context.clearRect(0, 0, this.width, this.height)
    this.particles = this.particles.filter((p) => p.life > 0)
    for (const p of this.particles) {
      if (p.delay > 0) {
        p.delay -= delta
        continue
      }
      p.life -= delta
      p.vy += p.gravity * delta
      p.x += p.vx * delta
      p.y += p.vy * delta
      p.vx *= Math.exp(-0.6 * delta)
      p.turn += p.spin * delta
      const ctx = this.context
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.turn)
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 0.6))
      ctx.fillStyle = p.color
      if (p.shape === 'dot') {
        ctx.beginPath()
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
        ctx.fill()
      } else if (p.shape === 'star') {
        ctx.beginPath()
        for (let point = 0; point < 8; point++) {
          const angle = (point * Math.PI) / 4
          const radius = p.size * (point % 2 ? 0.18 : 0.65)
          if (point === 0) {
            ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
          } else {
            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
          }
        }
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.scale(1, Math.cos(p.turn * 1.7))
        const height = p.shape === 'ribbon' ? p.size * 2.4 : p.size * 0.65
        ctx.fillRect(-p.size / 2, -height / 2, p.size, height)
      }
      ctx.restore()
    }
    if (this.particles.length) this.frame = requestAnimationFrame(this.draw)
    else {
      this.frame = 0
      this.context.clearRect(0, 0, this.width, this.height)
    }
  }

  private burst(
    x: number,
    y: number,
    level: number,
    mode: 'celebrate' | 'left' | 'right' | 'crumbs' | 'collect' = 'celebrate'
  ) {
    if (this.reduced() || !this.context || this.disposed) return
    const mobile = innerWidth < 680
    const crumbs = mode === 'crumbs'
    const collect = mode === 'collect'
    const side = mode === 'left' || mode === 'right'
    const crown = level >= 5 && !crumbs && !collect
    let amount = (mobile ? 24 : 40) + level * (mobile ? 12 : 22)
    let colors: readonly string[] = [
      BAKING_FX_COLORS[level],
      '#f9e7be',
      '#d9ba74',
      '#b9c9a5',
      '#d99d86',
    ]
    if (level >= 5) {
      colors = ['#f2d57b', '#f9eab9', '#d4a447', '#e8c766', '#b9c9a5']
    }
    if (side) amount = (mobile ? 10 : 18) + level * 3
    if (collect) amount = 10 + level * 4
    if (crumbs) {
      amount = 10 + level * 2
      colors = ['#76624d', '#96816a', '#b2a18a']
    }
    if (crown) amount = Math.ceil(amount * 1.6)
    let limit = mobile ? 180 : 320
    if (level >= 5) limit = mobile ? 260 : 420
    amount = Math.min(amount, Math.max(0, limit - this.particles.length))
    for (let i = 0; i < amount; i++) {
      let vx = (Math.random() - 0.5) * (240 + level * 45)
      let vy = -130 - Math.random() * (170 + level * 25)
      let gravity = 310
      let life = 1.6 + Math.random() * 0.8 + level * 0.12
      let delay = level >= 4 && i % 3 === 0 ? 0.28 : 0
      let shape: Particle['shape'] = i % 4 === 0 ? 'dot' : 'paper'
      if (level >= 3 && i % 5 === 0) shape = 'star'
      if (level >= 4 && i % 6 === 0) shape = 'ribbon'
      if (side) {
        vx = (mode === 'left' ? 1 : -1) * (100 + Math.random() * 190)
        vy -= 70
        delay = 0.13 + Math.random() * 0.12
      }
      if (crown) {
        life += 0.8
        gravity = 260
        delay += (i % 3) * 0.55 + Math.random() * 0.15
      }
      if (collect) {
        vx *= 0.3
        vy = -65 - Math.random() * 65
        gravity = 180
        life = 0.7 + Math.random() * 0.45
        delay = 0
        shape = 'star'
      }
      if (crumbs) {
        vx *= 0.3
        vy = -30 - Math.random() * 85
        life = 0.65 + Math.random() * 0.35
        delay = 0
        shape = 'dot'
      }
      let outward = 0
      if (mode === 'celebrate') outward = (mobile ? 28 : 36) * (i % 2 ? 1 : -1)
      if (collect) outward = 8 * (i % 2 ? 1 : -1)
      this.particles.push({
        x: x + outward + (Math.random() - 0.5) * 35,
        y: y + (Math.random() - 0.5) * 12,
        vx,
        vy,
        gravity,
        life,
        delay,
        shape,
        size: 3 + Math.random() * 4 + level * 0.35,
        turn: Math.random() * 6,
        spin: (Math.random() - 0.5) * 8,
        color: colors[i % colors.length],
      })
    }
    if (!this.frame) {
      this.lastTime = performance.now()
      this.frame = requestAnimationFrame(this.draw)
    }
  }

  async outcome(success: boolean, start: Origin, level = 0, reward = 0) {
    if (this.disposed || this.reduced()) return
    const p = this.origin(),
      jobs: Promise<unknown>[] = []
    if (!p || !start.size || !start.height) return
    this.portal.style.setProperty('--fx-accent', BAKING_FX_COLORS[level])
    if (success && level === 6) {
      this.reveal(true)
      try {
        await playWishingJackpot(this.root, this.portal, start, p, reward)
      } finally {
        this.reveal(false)
      }
      return
    }
    if (success) {
      this.reveal(true)
      const biscuit = this.node('fx-cookie', start.x, start.y, start.size)
      biscuit.style.height = `${start.height}px`
      const frames = Array.from({ length: 49 }, (_, i) => {
        const t = i / 48,
          blend = t * t * (3 - 2 * t),
          pulse = Math.sin(Math.PI * t) ** 2
        const width = start.size + (p.size - start.size) * blend,
          height = start.height + (p.height - start.height) * blend
        const sx = (width / start.size) * (1 + 0.55 * pulse),
          sy =
            ((height + (width - height) * pulse) / start.height) *
            (1 + 0.55 * pulse)
        return {
          offset: t,
          transform: `translate3d(-50%,-50%,0) translate3d(${(p.x - start.x) * blend}px,${(p.y - start.y) * blend - 44 * pulse}px,0) scale(${sx},${sy}) rotate(${-3 * pulse}deg)`,
        }
      })
      jobs.push(
        this.animate(biscuit, frames, {
          duration: COOKIE_ANIMATION_MS,
          easing: 'linear',
          fill: 'both',
        })
      )
      jobs.push(
        this.animate(
          this.node('fx-bloom', p.x, p.y - 35, 180 + level * 34),
          [
            { transform: 'translate(-50%,-50%) scale(.55)', opacity: 0 },
            {
              transform: 'translate(-50%,-50%) scale(1)',
              opacity: 0.45 + level * 0.07,
              offset: 0.4,
            },
            { transform: 'translate(-50%,-50%) scale(1.25)', opacity: 0 },
          ],
          { duration: COOKIE_ANIMATION_MS, easing: 'ease-out' }
        )
      )
      if (level >= 3) {
        jobs.push(
          this.animate(
            this.node('fx-rays', p.x, p.y - 35, 210 + level * 28),
            [
              {
                transform: 'translate(-50%,-50%) scale(.65) rotate(-12deg)',
                opacity: 0,
              },
              {
                transform: 'translate(-50%,-50%) scale(1) rotate(0deg)',
                opacity: 0.4,
                offset: 0.42,
              },
              {
                transform: 'translate(-50%,-50%) scale(1.2) rotate(12deg)',
                opacity: 0,
              },
            ],
            { duration: COOKIE_ANIMATION_MS, easing: 'ease-out' }
          )
        )
      }
      for (let ring = 0; ring < 1 + Math.floor(level / 2); ring++) {
        jobs.push(
          this.animate(
            this.node('fx-ring', p.x, p.y - 35, 110 + level * 18 + ring * 30),
            [
              { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 },
              {
                transform: 'translate(-50%,-50%) scale(1)',
                opacity: 0.8,
                offset: 0.35,
              },
              { transform: 'translate(-50%,-50%) scale(1.55)', opacity: 0 },
            ],
            {
              duration: COOKIE_ANIMATION_MS - ring * 60,
              delay: ring * 60,
              easing: 'ease-out',
            }
          )
        )
      }
      const sparkCount = 4 + level * 2
      for (let i = 0; i < sparkCount; i++) {
        const angle = (Math.PI * 2 * i) / sparkCount,
          dx = Math.cos(angle) * (65 + level * 18),
          dy = Math.sin(angle) * (50 + level * 14)
        const spark = this.node(
          'fx-spark',
          p.x + Math.cos(angle) * 12,
          p.y - 43 + Math.sin(angle) * 10,
          10 + (i % 3) * 4 + level
        )
        const svg = this.root
          .querySelector('[data-baking-spark] svg')
          ?.cloneNode(true)
        if (svg) spark.append(svg)
        jobs.push(
          this.animate(
            spark,
            [
              { transform: 'translate(-50%,-50%) scale(0)', opacity: 0 },
              {
                transform: `translate(calc(-50% + ${dx * 0.6}px),calc(-50% + ${dy * 0.6}px)) scale(1)`,
                opacity: 0.9,
                offset: 0.35,
              },
              {
                transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.4)`,
                opacity: 0,
              },
            ],
            { duration: 600 + (i % 3) * 60, delay: 80, easing: 'ease-out' }
          )
        )
      }
      this.burst(p.x, p.y - 40, level)
      if (level >= 3) {
        const spread =
          Math.min(this.width * 0.28, 180 + level * 20) +
          (innerWidth < 680 ? 18 : 24)
        this.burst(Math.max(20, p.x - spread), p.y + 65, level, 'left')
        this.burst(
          Math.min(this.width - 20, p.x + spread),
          p.y + 65,
          level,
          'right'
        )
      }
    } else {
      for (let i = 0; i < 4 + Math.floor(level / 2); i++) {
        const puff = this.node(
          'fx-puff',
          p.x + (Math.random() - 0.5) * 85,
          p.y - 45,
          40 + (i % 3) * 15
        )
        jobs.push(
          this.animate(
            puff,
            [
              { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 },
              {
                transform: 'translate(-50%,-70%) scale(.8)',
                opacity: 0.55,
                offset: 0.2,
              },
              {
                transform: `translate(calc(-50% + ${(i % 2 ? 1 : -1) * (25 + i * 4)}px),-190%) scale(1.6)`,
                opacity: 0,
              },
            ],
            {
              duration: 600 + (i % 3) * 40,
              delay: i * 20,
              easing: 'ease-out',
            }
          )
        )
      }
      this.burst(p.x, p.y + 18, level, 'crumbs')
    }
    await Promise.all(jobs)
    this.reveal(false)
  }

  async collect(value: number, level = 0) {
    if (this.disposed || this.reduced()) return
    const p = this.origin(),
      target = this.root.querySelector('#bank-cookie')?.getBoundingClientRect()
    if (!p || !target) return
    const bounds = this.portal.getBoundingClientRect()
    const targetX = target.x + target.width / 2 - bounds.x
    const targetY = target.y + target.height / 2 - bounds.y
    this.portal.style.setProperty('--fx-accent', BAKING_FX_COLORS[level])
    const dx = targetX - p.x,
      dy = targetY - p.y
    this.reveal(true)
    const biscuit = this.node('fx-cookie', p.x, p.y, p.size)
    biscuit.style.height = `${p.height}px`
    const flight = Array.from({ length: 41 }, (_, i) => {
      const t = i / 40,
        u = t * t * (3 - 2 * t),
        x = 2 * (1 - u) * u * dx * 0.2 + u * u * dx
      const y = 2 * (1 - u) * u * (Math.min(dy, 0) - 60) + u * u * dy,
        scale = 1 - 0.75 * u + 0.35 * Math.sin(Math.PI * t) ** 2
      return {
        offset: t,
        x,
        y,
        scale,
        turn: 18 * u,
        opacity: Math.min(1, (1 - t) * 5),
      }
    })
    const frames = flight.map((point) => ({
      offset: point.offset,
      transform: `translate3d(-50%,-50%,0) translate3d(${point.x}px,${point.y}px,0) scale(${point.scale}) rotate(${point.turn}deg)`,
      opacity: point.opacity,
    }))
    for (let i = 0; i < 4 + level * 2; i++) {
      const trail = this.node(
        'fx-trail',
        p.x + ((i % 3) - 1) * 6,
        p.y + (i % 2) * 5,
        4 + level * 0.7
      )
      void this.animate(
        trail,
        flight.map((point) => ({
          offset: point.offset,
          transform: `translate(-50%,-50%) translate3d(${point.x}px,${point.y}px,0) scale(${1 - point.offset * 0.7})`,
          opacity: Math.sin(Math.PI * point.offset) * 0.75,
        })),
        {
          duration: COOKIE_ANIMATION_MS - i * 18,
          delay: i * 18,
          easing: 'linear',
        }
      )
    }
    await this.animate(biscuit, frames, {
      duration: COOKIE_ANIMATION_MS,
      easing: 'linear',
      fill: 'both',
    })
    this.reveal(false)
    const visibleTarget = this.root
      .querySelector('#bank-cookie')
      ?.getBoundingClientRect()
    if (
      !this.disposed &&
      visibleTarget &&
      visibleTarget.bottom > 0 &&
      visibleTarget.top < innerHeight
    ) {
      this.burst(targetX, targetY, level, 'collect')
      this.bankPulse?.cancel()
      this.bankPulse = this.root
        .querySelector('#bank-cookie')
        ?.animate(
          [
            { transform: 'scale(1)' },
            { transform: `scale(${1.12 + level * 0.025})`, offset: 0.35 },
            { transform: 'scale(1)' },
          ],
          { duration: 500, easing: 'cubic-bezier(.22,1,.36,1)' }
        )
      const label = this.node('fx-label', targetX, target.y - bounds.y, 100)
      label.textContent = `+${value.toLocaleString()}`
      void this.animate(
        label,
        [
          { transform: 'translate(-50%,0)', opacity: 0 },
          { transform: 'translate(-50%,-14px)', opacity: 1, offset: 0.25 },
          { transform: 'translate(-50%,-36px)', opacity: 0 },
        ],
        { duration: 950, easing: 'ease-out' }
      )
    }
  }

  dispose() {
    this.disposed = true
    this.reveal(false)
    cancelAnimationFrame(this.frame)
    this.bankPulse?.cancel()
    this.observer.disconnect()
    window.removeEventListener('resize', this.resize)
    this.portal
      .getAnimations({ subtree: true })
      .forEach((animation) => animation.cancel())
    this.portal.remove()
  }
}
