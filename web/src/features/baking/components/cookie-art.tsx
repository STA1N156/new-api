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
const colors = [
  '#d3aa72',
  '#cda47a',
  '#a5b77e',
  '#ce9a8e',
  '#c6a05a',
  '#ceaa54',
  '#d7ae62',
]
const decorations = [
  <g key='level-0'>
    <g fill='#926440'>
      <rect
        x='24'
        y='27'
        width='10'
        height='8'
        rx='2'
        transform='rotate(-12 29 31)'
      />
      <rect
        x='65'
        y='25'
        width='9'
        height='10'
        rx='2'
        transform='rotate(16 69 30)'
      />
      <rect x='26' y='70' width='8' height='7' rx='2' />
      <circle cx='70' cy='73' r='4' />
    </g>
  </g>,
  <g key='level-1'>
    <path
      d='M23 43c-6-10 5-21 15-16 4-12 23-12 27 0 12-4 21 11 13 20 6 13-5 24-17 20-6 9-19 9-25 0-13 4-25-11-13-24Z'
      fill='#fbf3df'
    />
    <g fill='#d8bd8d'>
      <circle cx='20' cy='61' r='2' />
      <circle cx='75' cy='77' r='2' />
      <circle cx='28' cy='79' r='2' />
    </g>
  </g>,
  <g key='level-2'>
    <circle cx='50' cy='50' r='31' fill='#dce6bd' />
    <path
      d='M49 37c-12-1-15-11-14-16 10 0 16 5 14 16Zm2 0c-2-12 6-19 15-19 1 10-3 17-15 19Z'
      fill='#6d8a50'
    />
    <g fill='#79975a'>
      <circle cx='24' cy='59' r='2' />
      <circle cx='72' cy='43' r='2' />
      <circle cx='66' cy='77' r='2' />
      <circle cx='37' cy='78' r='2' />
    </g>
  </g>,
  <g key='level-3'>
    <circle cx='50' cy='50' r='31' fill='#f2d4c9' />
    <path d='M50 40 36 29c-8-10 7-18 14-8 7-10 22-2 14 8Z' fill='#bb615c' />
    <path
      d='M29 76q21 9 42-1'
      fill='none'
      stroke='#b9665c'
      strokeWidth='4'
      strokeLinecap='round'
    />
  </g>,
  <g key='level-4'>
    <circle cx='50' cy='50' r='32' fill='#edcf94' />
    <circle
      cx='50'
      cy='50'
      r='27'
      fill='none'
      stroke='#b9823e'
      strokeWidth='3'
    />
    <path
      d='M34 35c3-11 23-13 30-3 4 6 0 12-7 12-6 0-10-4-8-8 2-4 8-4 10 0'
      fill='none'
      stroke='#c28b45'
      strokeWidth='3.5'
      strokeLinecap='round'
    />
    <g fill='#b9823e'>
      <circle cx='24' cy='51' r='1.8' />
      <circle cx='76' cy='51' r='1.8' />
      <circle cx='50' cy='77' r='1.8' />
    </g>
  </g>,
  <g key='level-5'>
    <circle cx='50' cy='50' r='31' fill='#f4dfa0' />
    <path
      d='m28 24 12 8 10-16 10 16 12-8-5 23H33Z'
      fill='#d6a940'
      stroke='#ae8231'
      strokeWidth='1.5'
      strokeLinejoin='round'
    />
    <path d='M35 41h30' stroke='#fff1be' strokeWidth='2' />
    <circle cx='50' cy='34' r='3' fill='#c87155' />
  </g>,
  <g key='level-6'>
    <circle cx='50' cy='50' r='33' fill='#fff2cd' />
    <circle
      cx='50'
      cy='50'
      r='29'
      fill='none'
      stroke='#e0bf77'
      strokeWidth='1.5'
    />
    <path
      d='m50 15 5 9 10 2-7 8 1 11-9-5-9 5 1-11-7-8 10-2Z'
      fill='#e8b953'
      stroke='#b88935'
      strokeWidth='1.3'
      strokeLinejoin='round'
    />
    <path
      d='m50 24 5 6-5 7-5-7Z'
      fill='#a8c9c7'
      stroke='#fff8e5'
      strokeWidth='1.2'
    />
    <g strokeWidth='2.6' strokeLinecap='round'>
      <path d='m25 40 3 2m44 27 3 2' stroke='#c792a1' />
      <path d='m24 68 3-2m46-28 3-2' stroke='#91b9a1' />
      <path d='m39 77 2 2m20-2-2 2' stroke='#b4a4ce' />
    </g>
    <g fill='#c69442'>
      <circle cx='50' cy='81' r='1.8' />
      <circle cx='20' cy='53' r='1.5' />
      <circle cx='80' cy='53' r='1.5' />
    </g>
  </g>,
]

export function CookieArt(props: { level?: number; className?: string }) {
  const level = Math.max(0, Math.min(colors.length - 1, props.level ?? 0))
  return (
    <svg className={props.className} viewBox='0 0 100 100' aria-hidden='true'>
      <path
        d='M50 6C62 5 65 9 74 12C87 15 92 26 94 37C100 50 93 63 90 74C85 84 74 92 62 94C48 101 33 93 24 89C12 86 7 74 6 63C1 50 8 40 9 28C15 17 25 9 37 8Z'
        fill={colors[level]}
        stroke='#8b6d4655'
        strokeWidth='2'
      />
      {decorations[level]}
      <g fill='#654c36'>
        <ellipse cx='39' cy='53' rx='2.4' ry='3' />
        <ellipse cx='61' cy='53' rx='2.4' ry='3' />
      </g>
      <path
        d='M45 61q5 5 10 0'
        fill='none'
        stroke='#745039'
        strokeWidth='2'
        strokeLinecap='round'
      />
      <g fill='#c87d62' opacity='.4'>
        <ellipse cx='31' cy='61' rx='5' ry='3' />
        <ellipse cx='69' cy='61' rx='5' ry='3' />
      </g>
    </svg>
  )
}
