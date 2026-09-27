'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

const FIRST_NAME = 'Thierry';
const LAST_NAME = 'Ramanitra';
const STEP = 0.3;
const INTRO_DURATION = 1.6;
const TOTAL_LETTERS = FIRST_NAME.length + 1 + LAST_NAME.length;
// Pause after the last letter settles, before the neon color-cycle takes over.
const CYCLE_DELAY = (TOTAL_LETTERS - 1) * STEP + INTRO_DURATION + 1.5;
// Must match hologram-cycle's own duration in globals.css.
const CYCLE_DURATION = 11;
const TOTAL_LOOP_MS = (CYCLE_DELAY + CYCLE_DURATION) * 1000;

function letterStyle(index: number): CSSProperties {
    return {
        '--d': `${index * STEP}s`,
        // The magnifying-lens pulse only kicks in once this letter's own entrance settles.
        '--ld': `${index * STEP + INTRO_DURATION}s`,
    } as CSSProperties;
}

function AnimatedWord({ word, offset, accent }: { word: string; offset: number; accent?: boolean }) {
    return (
        <>
            {word.split('').map((letter, i) => (
                <span
                    key={i}
                    className={accent ? 'hologram-letter hologram-logo-accent' : 'hologram-letter'}
                    style={letterStyle(offset + i)}
                >
                    {letter}
                </span>
            ))}
        </>
    );
}

export function HologramLogo() {
    const [animate, setAnimate] = useState(false);
    const [loopKey, setLoopKey] = useState(0);
    const restarted = useRef(false);

    useEffect(() => {
        restarted.current = false;
        let frame = 0;

        // Wait for the first real paint so the "all hidden" state is actually
        // visible before the reveal starts, regardless of page load timing.
        frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => {
                const target = performance.now() + TOTAL_LOOP_MS;
                setAnimate(true);

                // Poll the clock every frame instead of relying on a single
                // browser event (CSS `animationend` behaves inconsistently
                // across engines when several animations share an element) or
                // a lone `setTimeout` (which can drift). A rAF loop checked
                // every frame against an absolute target time can't fire early
                // and re-checks itself continuously until it's genuinely due.
                const tick = () => {
                    if (performance.now() >= target) {
                        if (!restarted.current) {
                            restarted.current = true;
                            setAnimate(false);
                            setLoopKey((k) => k + 1);
                        }
                        return;
                    }
                    frame = requestAnimationFrame(tick);
                };
                frame = requestAnimationFrame(tick);
            });
        });

        return () => cancelAnimationFrame(frame);
    }, [loopKey]);

    return (
        <span
            className={animate ? 'hologram-logo is-animating' : 'hologram-logo'}
            aria-label={`${FIRST_NAME} ${LAST_NAME}`}
            style={{ '--cycle-delay': `${CYCLE_DELAY}s` } as CSSProperties}
        >
            <span aria-hidden="true" key={loopKey}>
                <AnimatedWord word={FIRST_NAME} offset={0} />
                <span className="hologram-letter" style={letterStyle(FIRST_NAME.length)}>
                    &nbsp;
                </span>
                <AnimatedWord word={LAST_NAME} offset={FIRST_NAME.length + 1} accent />
            </span>
        </span>
    );
}
