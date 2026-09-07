import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AvatarComponent, AvatarShape, AvatarSize, AvatarStatus } from './avatar.component';

@Component({
    standalone: true,
    imports: [AvatarComponent],
    template: ` <app-avatar [src]="src()" [alt]="alt()" [initials]="initials()" [size]="size()" [shape]="shape()" [status]="status()" /> `
})
class TestHostComponent {
    readonly src = signal<string>('');
    readonly alt = signal<string>('');
    readonly initials = signal<string>('');
    readonly size = signal<AvatarSize>('default');
    readonly shape = signal<AvatarShape>('circle');
    readonly status = signal<AvatarStatus | null>(null);
}

describe('AvatarComponent', () => {
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

    it('should render default fallback SVG icon when neither src nor initials are provided', () => {
        const fallback = fixture.nativeElement.querySelector('.avatar-fallback');
        expect(fallback).toBeTruthy();

        const svg = fallback.querySelector('.avatar-default-icon');
        expect(svg).toBeTruthy();
    });

    it('should render initials when provided without image src', () => {
        host.initials.set('BM');
        fixture.detectChanges();

        const fallback = fixture.nativeElement.querySelector('.avatar-fallback');
        expect(fallback.textContent?.trim()).toBe('BM');
    });

    it('should render image when valid src is provided', () => {
        host.src.set('https://bayesmarket.io/avatar.png');
        host.alt.set('Trader profile picture');
        fixture.detectChanges();

        const img = fixture.nativeElement.querySelector('.avatar-image') as HTMLImageElement;
        expect(img).toBeTruthy();
        expect(img.src).toContain('bayesmarket.io/avatar.png');
        expect(img.alt).toBe('Trader profile picture');
    });

    it('should fallback to initials when image triggers an error event', () => {
        host.src.set('https://broken-link.com/avatar.png');
        host.initials.set('JD');
        fixture.detectChanges();

        const img = fixture.nativeElement.querySelector('.avatar-image') as HTMLImageElement;
        expect(img).toBeTruthy();

        // Dispatch image loading failure event
        img.dispatchEvent(new Event('error'));
        fixture.detectChanges();

        const fallback = fixture.nativeElement.querySelector('.avatar-fallback');
        expect(fallback).toBeTruthy();
        expect(fallback.textContent?.trim()).toBe('JD');
    });

    it('should dynamically switch size classes', () => {
        const sizes: AvatarSize[] = ['sm', 'lg', 'xl', 'default'];
        const container = fixture.nativeElement.querySelector('.avatar') as HTMLDivElement;

        for (const s of sizes) {
            host.size.set(s);
            fixture.detectChanges();
            expect(container.classList.contains(`avatar-size-${s}`)).toBe(true);
        }
    });

    it('should dynamically switch shapes', () => {
        const container = fixture.nativeElement.querySelector('.avatar') as HTMLDivElement;
        expect(container.classList.contains('avatar-shape-circle')).toBe(true);

        host.shape.set('square');
        fixture.detectChanges();
        expect(container.classList.contains('avatar-shape-square')).toBe(true);
    });

    it('should render status indicator dot when status is set', () => {
        host.status.set('online');
        fixture.detectChanges();

        let dot = fixture.nativeElement.querySelector('.avatar-status-dot');
        expect(dot).toBeTruthy();
        expect(dot.classList.contains('avatar-status-online')).toBe(true);

        host.status.set('busy');
        fixture.detectChanges();
        dot = fixture.nativeElement.querySelector('.avatar-status-dot');
        expect(dot.classList.contains('avatar-status-busy')).toBe(true);
    });
});
