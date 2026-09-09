import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BrandIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

@Component({
    selector: 'app-brand-icon',
    standalone: true,
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div
            class="brand-icon-wrapper"
            [class.has-glow]="glow()"
            [style.width.px]="pixelSize()"
            [style.height.px]="pixelSize()"
            role="img"
            [attr.aria-label]="ariaLabel() || 'BayesMarket emblem'"
        >
            <svg
                class="brand-icon-svg"
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
            >
                <defs>
                    <!-- Background matching BayesMarket surface tokens -->
                    <linearGradient [id]="idPrefix() + '-bg'" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#14112c" />
                        <stop offset="100%" stop-color="#080711" />
                    </linearGradient>

                    <!-- Neon Rim: Royal Violet (#7c4dff) -> Electric Sky (#38bdf8) -> Mint (#00dc82) -->
                    <linearGradient [id]="idPrefix() + '-rim'" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#7c4dff" stop-opacity="0.95" />
                        <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.9" />
                        <stop offset="100%" stop-color="#00dc82" stop-opacity="0.85" />
                    </linearGradient>

                    <!-- Core Glyph: Royal Violet (#7c4dff) -> Electric Lavender (#c4b5fd) -->
                    <linearGradient [id]="idPrefix() + '-glyph'" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#7c4dff" />
                        <stop offset="50%" stop-color="#a855f7" />
                        <stop offset="100%" stop-color="#c4b5fd" />
                    </linearGradient>

                    <!-- Ascending Prediction Vector: Sky Blue (#7dd3fc) -> Mint (#00dc82) -->
                    <linearGradient [id]="idPrefix() + '-vec'" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#7dd3fc" />
                        <stop offset="100%" stop-color="#00dc82" />
                    </linearGradient>

                    <!-- Radial Core Violet Glow -->
                    <radialGradient [id]="idPrefix() + '-glow'" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="#7c4dff" stop-opacity="0.32" />
                        <stop offset="60%" stop-color="#38bdf8" stop-opacity="0.08" />
                        <stop offset="100%" stop-color="#7c4dff" stop-opacity="0" />
                    </radialGradient>
                </defs>

                <!-- Squircle Emblem Container -->
                <rect x="2.5" y="2.5" width="59" height="59" rx="16" [attr.fill]="'url(#' + idPrefix() + '-bg)'" />
                <rect
                    x="2.5"
                    y="2.5"
                    width="59"
                    height="59"
                    rx="16"
                    [attr.stroke]="'url(#' + idPrefix() + '-rim)'"
                    stroke-width="1.8"
                />

                <!-- Ambient Radial Core Glow -->
                <circle cx="32" cy="32" r="22" [attr.fill]="'url(#' + idPrefix() + '-glow)'" />

                <!-- Bayesian Normal Bell Curve (Prior Probability Wave) -->
                <path
                    d="M10 46 C18 46, 24 23, 32 23 C40 23, 46 46, 54 46"
                    stroke="#7dd3fc"
                    stroke-width="1.6"
                    stroke-dasharray="2 3.5"
                    stroke-opacity="0.4"
                    stroke-linecap="round"
                />

                <!-- Bayesian 'B' Emblem Vertical Spine -->
                <rect x="18" y="14" width="4.5" height="36" rx="2.25" [attr.fill]="'url(#' + idPrefix() + '-glyph)'" />

                <!-- Upper Loop (Prior Distribution) -->
                <path
                    d="M19.5 15.5 H33 C38.5 15.5, 42 19, 42 24 C42 29, 38.5 32, 33 32 H19.5"
                    [attr.stroke]="'url(#' + idPrefix() + '-glyph)'"
                    stroke-width="4.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />

                <!-- Lower Loop (Posterior Distribution) -->
                <path
                    d="M19.5 32 H35 C41.5 32, 45.5 35.5, 45.5 41 C45.5 46.5, 41.5 49, 35 49 H19.5"
                    [attr.stroke]="'url(#' + idPrefix() + '-glyph)'"
                    stroke-width="4.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />

                <!-- Ascending Prediction Vector -->
                <path
                    d="M13 42 L26 28 L37 34 L48 16"
                    [attr.stroke]="'url(#' + idPrefix() + '-vec)'"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />

                <!-- Probability Vertices (Sky & Mint YES outcome) -->
                <circle cx="26" cy="28" r="2.2" fill="#38bdf8" />
                <circle cx="48" cy="16" r="3.4" fill="#00dc82" />
                <circle cx="48" cy="16" r="1.6" fill="#ffffff" />
            </svg>
        </div>
    `,
    styles: [
        `
            :host {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                vertical-align: middle;
                user-select: none;
                flex-shrink: 0;
            }

            .brand-icon-wrapper {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                position: relative;
                transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), filter 200ms ease;
            }

            .brand-icon-svg {
                width: 100%;
                height: 100%;
                display: block;
            }

            .has-glow {
                filter: drop-shadow(0 0 10px rgba(124, 77, 255, 0.45)) drop-shadow(0 0 16px rgba(56, 189, 248, 0.25));
            }

            :host(:hover) .brand-icon-wrapper {
                transform: scale(1.06);
            }
        `,
    ],
})
export class BrandIconComponent {
    public readonly size = input<BrandIconSize>('md');
    public readonly glow = input<boolean>(false);
    public readonly ariaLabel = input<string>('BayesMarket emblem');

    private static nextId = 0;
    protected readonly idPrefix = computed(() => `bm-icon-${++BrandIconComponent.nextId}`);

    protected readonly pixelSize = computed(() => {
        const s = this.size();
        if (typeof s === 'number') {
            return s;
        }
        switch (s) {
            case 'xs':
                return 18;
            case 'sm':
                return 24;
            case 'md':
                return 32;
            case 'lg':
                return 44;
            case 'xl':
                return 56;
            default:
                return 32;
        }
    });
}
