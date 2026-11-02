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
const icons = {
  spark: (
    <g
      fill='none'
      stroke='currentColor'
      strokeWidth='1.65'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path
        d='M12 3c.7 5.6 3.4 8.3 9 9-5.6.7-8.3 3.4-9 9-.7-5.6-3.4-8.3-9-9 5.6-.7 8.3-3.4 9-9Z'
        fill='currentColor'
        fillOpacity='.08'
      />
    </g>
  ),
  fire: (
    <g
      fill='none'
      stroke='currentColor'
      strokeWidth='1.65'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path
        d='M12.6 2.8c.6 3.4-1.7 5.3-3.5 7.2-.5-1.3-.8-2.1-1.1-2.7C5.5 10 4.5 12.2 4.5 14.6a7.5 7.5 0 0 0 15 0c0-4.4-3.1-8.3-6.9-11.8Z'
        fill='currentColor'
        fillOpacity='.08'
      />
      <path
        d='M12.2 12c.2 1.5-1.8 2.5-1.8 4.1a2.3 2.3 0 0 0 4.6 0c0-1.6-1-3-2.8-4.1Z'
        fill='currentColor'
        stroke='none'
      />
    </g>
  ),
  gift: (
    <g
      fill='none'
      stroke='currentColor'
      strokeWidth='1.65'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <rect x='3' y='8' width='18' height='4' rx='1' />
      <path d='M5 12v8h14v-8M12 8v12' />
      <path d='M12 8H8a3 3 0 1 1 3-3Zm0 0h4a3 3 0 1 0-3-3Z' />
    </g>
  ),
  arrow: (
    <g
      fill='none'
      stroke='currentColor'
      strokeWidth='1.65'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M4 12h15m-6-6 6 6-6 6' />
    </g>
  ),
  check: (
    <g
      fill='none'
      stroke='currentColor'
      strokeWidth='1.65'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='m5 12 4 4L19 6' />
    </g>
  ),
  info: (
    <g
      fill='none'
      stroke='currentColor'
      strokeWidth='1.65'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <circle cx='12' cy='12' r='9' />
      <path d='M12 11v6' />
      <path d='M12 7h.01' strokeWidth='2.8' />
    </g>
  ),
  calendar: (
    <g
      fill='none'
      stroke='currentColor'
      strokeWidth='1.65'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <rect x='3.5' y='5' width='17' height='16' rx='2.5' />
      <path d='M8 3v4m8-4v4M3.5 10h17M8 14h2m4 0h2M8 17h2' />
    </g>
  ),
}
export function BakingIcon(props: {
  name: keyof typeof icons
  className?: string
}) {
  return (
    <svg className={props.className} viewBox='0 0 24 24' aria-hidden='true'>
      {icons[props.name]}
    </svg>
  )
}
