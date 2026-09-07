import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SwitchColor, SwitchComponent, SwitchSize } from './switch.component';

@Component({
    standalone: true,
    imports: [SwitchComponent],
    template: ` <app-switch [(checked)]="isChecked" [disabled]="disabled()" [size]="size()" [color]="color()" ariaLabel="Toggle live orderbook depth" /> `
})
class TestHostComponent {
    isChecked = false;
    readonly disabled = signal(false);
    readonly size = signal<SwitchSize>('default');
    readonly color = signal<SwitchColor>('primary');
}

describe('SwitchComponent', () => {
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

    it('should render switch with role="switch" and aria-checked="false"', () => {
        const switchBtn = fixture.nativeElement.querySelector('button[role="switch"]') as HTMLButtonElement;
        expect(switchBtn).toBeTruthy();
        expect(switchBtn.getAttribute('aria-checked')).toBe('false');
        expect(switchBtn.classList.contains('switch-checked')).toBe(false);
    });

    it('should toggle checked state and update two-way model on click', () => {
        const switchBtn = fixture.nativeElement.querySelector('button[role="switch"]') as HTMLButtonElement;
        switchBtn.click();
        fixture.detectChanges();

        expect(host.isChecked).toBe(true);
        expect(switchBtn.getAttribute('aria-checked')).toBe('true');
        expect(switchBtn.classList.contains('switch-checked')).toBe(true);

        // Click again to toggle off
        switchBtn.click();
        fixture.detectChanges();

        expect(host.isChecked).toBe(false);
        expect(switchBtn.getAttribute('aria-checked')).toBe('false');
    });

    it('should not toggle when disabled is true', () => {
        host.disabled.set(true);
        fixture.detectChanges();

        const switchBtn = fixture.nativeElement.querySelector('button[role="switch"]') as HTMLButtonElement;
        expect(switchBtn.disabled).toBe(true);

        switchBtn.click();
        fixture.detectChanges();

        expect(host.isChecked).toBe(false);
    });

    it('should toggle on Space and Enter keyboard events', () => {
        const switchBtn = fixture.nativeElement.querySelector('button[role="switch"]') as HTMLButtonElement;

        switchBtn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        fixture.detectChanges();
        expect(host.isChecked).toBe(true);

        switchBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        fixture.detectChanges();
        expect(host.isChecked).toBe(false);
    });

    it('should dynamically switch size classes', () => {
        const sizes: SwitchSize[] = ['sm', 'lg', 'default'];
        const switchBtn = fixture.nativeElement.querySelector('button[role="switch"]') as HTMLButtonElement;

        for (const s of sizes) {
            host.size.set(s);
            fixture.detectChanges();
            expect(switchBtn.classList.contains(`switch-size-${s}`)).toBe(true);
        }
    });

    it('should apply color variant class', () => {
        host.color.set('yes');
        fixture.detectChanges();

        const switchBtn = fixture.nativeElement.querySelector('button[role="switch"]') as HTMLButtonElement;
        expect(switchBtn.classList.contains('switch-color-yes')).toBe(true);
    });
});
