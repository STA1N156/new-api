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
import { memo, useState } from 'react'

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const ANIMATED_TAIL = 160
type StreamCharacter = { segment: string; index: number; delay: number }

/** Stable character keys keep earlier text still as the stream appends. */
export const StreamingText = memo(({ children }: { children: string }) => {
  const [stream, setStream] = useState({
    text: '',
    characters: [] as StreamCharacter[],
  })
  if (children !== stream.text) {
    const characters = [...segmenter.segment(children)].slice(-ANIMATED_TAIL)
    const previous = new Map(
      children.startsWith(stream.text)
        ? stream.characters.map((character) => [character.index, character])
        : []
    )
    const addedCount = characters.filter(
      ({ index, segment }) => previous.get(index)?.segment !== segment
    ).length
    // Stagger each new batch, without delaying a large chunk for several seconds.
    const step = Math.min(18, 240 / Math.max(1, addedCount - 1))
    let addedIndex = 0
    setStream({
      text: children,
      characters: characters.map(({ segment, index }) => {
        const existing = previous.get(index)
        return existing?.segment === segment
          ? existing
          : { segment, index, delay: addedIndex++ * step }
      }),
    })
  }
  const prefix = stream.text.slice(
    0,
    stream.characters[0]?.index ?? stream.text.length
  )

  return (
    <>
      {prefix}
      {stream.characters.map(({ segment, index, delay }) => (
        <span
          key={index}
          data-stream-fade
          className='response-stream-character'
          style={{
            animationDelay: `${delay}ms`,
          }}
        >
          {segment}
        </span>
      ))}
    </>
  )
})
StreamingText.displayName = 'StreamingText'
