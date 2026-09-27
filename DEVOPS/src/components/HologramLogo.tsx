import { useEffect, useRef, useState, type CSSProperties } from 'react'

const STEP = 0.3
const INTRO_DURATION = 1.6
const CYCLE_DURATION = 11 // must match hologram-cycle's own duration in index.css

function letterStyle(index: number): CSSProperties {
    return {
        '--d': `${index * STEP}s`,
        // The magnifying-lens pulse only kicks in once this letter's own entrance settles.
        '--ld': `${index * STEP + INTRO_DURATION}s`,
    } as CSSProperties
}

interface HologramLogoProps {
    text: string
    /** Highlights the last word in the accent color, like the portfolio's surname. */
    accentLastWord?: boolean
}

export function HologramLogo({ text, accentLastWord }: HologramLogoProps) {
    const [animate, setAnimate] = useState(false)
    const [loopKey, setLoopKey] = useState(0)
    const restarted = useRef(false)

    const words = text.split(' ')
    const accentStart = accentLastWord ? text.length - words[words.length - 1].length : -1
    const totalLetters = text.length
    const cycleDelay = (totalLetters - 1) * STEP + INTRO_DURATION + 1.5
    const totalLoopMs = (cycleDelay + CYCLE_DURATION) * 1000

    useEffect(() => {
        restarted.current = false
        let frame = 0

        // Wait for the first real paint so the "all hidden" state is actually
        // visible before the reveal starts, regardless of page load timing.
        frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => {
                const target = performance.now() + totalLoopMs
                setAnimate(true)

                const tick = () => {
                    if (performance.now() >= target) {
                        if (!restarted.current) {
                            restarted.current = true
                            setAnimate(false)
                            setLoopKey((k) => k + 1)
                        }
                        return
                    }
                    frame = requestAnimationFrame(tick)
                }
                frame = requestAnimationFrame(tick)
            })
        })

        return () => cancelAnimationFrame(frame)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loopKey])

    return (
        <span
            className={animate ? 'hologram-logo is-animating' : 'hologram-logo'}
            aria-label={text}
            style={{ '--cycle-delay': `${cycleDelay}s` } as CSSProperties}
        >
            <span aria-hidden="true" key={loopKey}>
                {text.split('').map((letter, i) => (
                    <span
                        key={i}
                        className={i >= accentStart && accentLastWord ? 'hologram-letter hologram-logo-accent' : 'hologram-letter'}
                        style={letterStyle(i)}
                    >
                        {letter === ' ' ? ' ' : letter}
                    </span>
                ))}
            </span>
        </span>
    )
}
