import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonComponent, ButtonSize, ButtonVariant } from './button.component';

@Component({
    standalone: true,
    imports: [ButtonComponent],
    template: `
        <app-button
            [variant]="variant()"
            [size]="size()"
            [disabled]="disabled()"
            [loading]="loading()"
            [fullWidth]="fullWidth()"
            [selected]="selected()"
            [ariaLabel]="ariaLabel()"
            (btnClick)="handleClick($event)"
        >
            {{ text() }}
        </app-button>
    `
})
class TestHostComponent {
    readonly variant = signal<ButtonVariant>('primary');
    readonly size = signal<ButtonSize>('default');
    readonly disabled = signal(false);
    readonly loading = signal(false);
    readonly fullWidth = signal(false);
    readonly selected = signal(false);
    readonly ariaLabel = signal('');
    readonly text = signal('Execute Trade');
    clicked = false;

    handleClick(_event: MouseEvent): void {
        this.clicked = true;
    }
}

describe('ButtonComponent', () => {
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

    it('should render projected text and apply default primary variant and default size', () => {
        const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
        expect(btn).toBeTruthy();
        expect(btn.textContent?.trim()).toContain('Execute Trade');
        expect(btn.classList.contains('btn-variant-primary')).toBe(true);
        expect(btn.classList.contains('btn-size-default')).toBe(true);
    });

    it('should emit btnClick event when clicked in normal state', () => {
        const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
        btn.click();
        expect(host.clicked).toBe(true);
    });

    it('should not emit btnClick and be disabled when disabled is true', () => {
        host.disabled.set(true);
        fixture.detectChanges();

        const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
        expect(btn.disabled).toBe(true);

        host.clicked = false;
        btn.click();
        expect(host.clicked).toBe(false);
    });

    it('should render loading spinner, set aria-busy, and disable button when loading is true', () => {
        host.loading.set(true);
        fixture.detectChanges();

        const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
        expect(btn.getAttribute('aria-busy')).toBe('true');

        const spinner = btn.querySelector('.btn-spinner');
        expect(spinner).toBeTruthy();

        host.clicked = false;
        btn.click();
        expect(host.clicked).toBe(false);
    });

    it('should dynamically switch variant classes', () => {
        const variants: ButtonVariant[] = ['secondary', 'destructive', 'outline', 'ghost', 'link', 'yes', 'no', 'chip'];
        const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

        for (const v of variants) {
            host.variant.set(v);
            fixture.detectChanges();
            expect(btn.classList.contains(`btn-variant-${v}`)).toBe(true);
            expect(btn.classList.contains(`btn-${v}`)).toBe(true);
        }
    });

    it('should toggle selected state and set aria-pressed on outcome and chip variants', () => {
        host.variant.set('yes');
        fixture.detectChanges();

        const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
        expect(btn.getAttribute('aria-pressed')).toBe('false');
        expect(btn.classList.contains('selected')).toBe(false);

        host.selected.set(true);
        fixture.detectChanges();
        expect(btn.getAttribute('aria-pressed')).toBe('true');
        expect(btn.classList.contains('selected')).toBe(true);

        // Chip variant
        host.variant.set('chip');
        host.selected.set(false);
        fixture.detectChanges();
        expect(btn.classList.contains('btn-variant-chip')).toBe(true);
        expect(btn.getAttribute('aria-pressed')).toBe('false');
        expect(btn.classList.contains('selected')).toBe(false);

        host.selected.set(true);
        fixture.detectChanges();
        expect(btn.getAttribute('aria-pressed')).toBe('true');
        expect(btn.classList.contains('selected')).toBe(true);
    });

    it('should dynamically switch size classes', () => {
        const sizes: ButtonSize[] = ['sm', 'lg', 'icon', 'pill'];
        const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

        for (const s of sizes) {
            host.size.set(s);
            fixture.detectChanges();
            expect(btn.classList.contains(`btn-size-${s}`)).toBe(true);
        }
    });

    it('should apply full-width class when fullWidth is true', () => {
        host.fullWidth.set(true);
        fixture.detectChanges();

        const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
        expect(btn.classList.contains('btn-full-width')).toBe(true);
    });

    it('should attach aria-label attribute when provided', () => {
        host.ariaLabel.set('Confirm binary outcome purchase');
        fixture.detectChanges();

        const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
        expect(btn.getAttribute('aria-label')).toBe('Confirm binary outcome purchase');
    });
});
