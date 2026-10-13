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
const MAX_NEW_PARTS = 160
const MAX_RETAINED_PARTS = 320

type StreamPart = { segment: string; index: number; delay: number }

/** Keep old text stable and cap animated spans even for large streaming chunks. */
export const StreamingText = memo((props: { children: string }) => {
  const [stream, setStream] = useState({ text: '', parts: [] as StreamPart[] })
  if (props.children !== stream.text) {
    const isAppend = props.children.startsWith(stream.text)
    // Include the last part so emoji and combining marks can cross chunk boundaries.
    const offset = isAppend
      ? (stream.parts.at(-1)?.index ?? stream.text.length)
      : 0
    const added = Array.from(
      segmenter.segment(props.children.slice(offset)),
      ({ segment, index }) => ({ segment, index: offset + index })
    ).filter(
      (part) =>
        !isAppend || part.index + part.segment.length > stream.text.length
    )
    const addedStart = added[0]?.index ?? props.children.length
    const previous = isAppend
      ? stream.parts
          .filter((part) => part.index < addedStart)
          .map((part) => ({
            ...part,
            segment: part.segment.slice(0, addedStart - part.index),
          }))
      : []
    const groupSize = Math.max(1, Math.ceil(added.length / MAX_NEW_PARTS))
    const partCount = Math.ceil(added.length / groupSize)
    const step = Math.min(14, 280 / Math.max(1, partCount - 1))
    const parts: StreamPart[] = []
    for (let index = 0; index < added.length; index += groupSize) {
      parts.push({
        segment: added
          .slice(index, index + groupSize)
          .map((part) => part.segment)
          .join(''),
        index: added[index].index,
        delay: (index / groupSize) * step,
      })
    }
    setStream({
      text: props.children,
      parts: [...previous, ...parts].slice(-MAX_RETAINED_PARTS),
    })
  }
  const prefix = stream.text.slice(
    0,
    stream.parts[0]?.index ?? stream.text.length
  )

  return (
    <>
      {prefix}
      {stream.parts.map(({ segment, index, delay }) => (
        <span
          key={index}
          data-stream-reveal
          className='response-stream-character'
          style={{ animationDelay: `${delay}ms` }}
        >
          {segment}
        </span>
      ))}
    </>
  )
})
StreamingText.displayName = 'StreamingText'
