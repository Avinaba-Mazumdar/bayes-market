import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BadgeComponent, BadgeSize, BadgeVariant } from './badge.component';

@Component({
    standalone: true,
    imports: [BadgeComponent],
    template: `
        <app-badge [variant]="variant()" [size]="size()">
            {{ text() }}
        </app-badge>
    `
})
class TestHostComponent {
    readonly variant = signal<BadgeVariant>('default');
    readonly size = signal<BadgeSize>('default');
    readonly text = signal('LIVE');
}

describe('BadgeComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should render projected content with default variant and size', () => {
        const badge = fixture.nativeElement.querySelector('.badge') as HTMLSpanElement;
        expect(badge).toBeTruthy();
        expect(badge.textContent?.trim()).toBe('LIVE');
        expect(badge.classList.contains('badge-variant-default')).toBe(true);
        expect(badge.classList.contains('badge-size-default')).toBe(true);
    });

    it('should dynamically switch variant classes across all design system tokens', () => {
        const variants: BadgeVariant[] = ['secondary', 'destructive', 'outline', 'profit', 'loss', 'warning', 'info', 'resolved'];
        const badge = fixture.nativeElement.querySelector('.badge') as HTMLSpanElement;

        for (const v of variants) {
            host.variant.set(v);
            fixture.detectChanges();
            expect(badge.classList.contains(`badge-variant-${v}`)).toBe(true);
            expect(badge.classList.contains(`badge-${v}`)).toBe(true);
        }
    });

    it('should dynamically switch sizes', () => {
        const sizes: BadgeSize[] = ['sm', 'lg', 'default'];
        const badge = fixture.nativeElement.querySelector('.badge') as HTMLSpanElement;

        for (const s of sizes) {
            host.size.set(s);
            fixture.detectChanges();
            expect(badge.classList.contains(`badge-size-${s}`)).toBe(true);
        }
    });
});
