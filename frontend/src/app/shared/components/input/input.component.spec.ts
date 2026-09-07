import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InputComponent, InputSize, InputType, InputVariant } from './input.component';

@Component({
    standalone: true,
    imports: [InputComponent],
    template: `
        <app-input
            [(value)]="val"
            [type]="type()"
            [placeholder]="placeholder()"
            [disabled]="disabled()"
            [error]="error()"
            [size]="size()"
            [variant]="variant()"
        >
            <span prefix class="test-prefix">$</span>
            <span suffix class="test-suffix">USDC</span>
        </app-input>
    `
})
class TestHostComponent {
    val = '';
    readonly type = signal<InputType>('text');
    readonly placeholder = signal('Enter order size');
    readonly disabled = signal(false);
    readonly error = signal<string | boolean>('');
    readonly size = signal<InputSize>('default');
    readonly variant = signal<InputVariant>('default');
}

describe('InputComponent', () => {
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

    it('should render native input with placeholder and default size', () => {
        const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
        expect(input).toBeTruthy();
        expect(input.placeholder).toBe('Enter order size');

        const wrapper = fixture.nativeElement.querySelector('.input-wrapper') as HTMLDivElement;
        expect(wrapper.classList.contains('input-size-default')).toBe(true);
    });

    it('should project prefix and suffix content', () => {
        const prefix = fixture.nativeElement.querySelector('.test-prefix');
        const suffix = fixture.nativeElement.querySelector('.test-suffix');
        expect(prefix?.textContent?.trim()).toBe('$');
        expect(suffix?.textContent?.trim()).toBe('USDC');
    });

    it('should update model value on user input', () => {
        const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
        input.value = '250';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        expect(host.val).toBe('250');
    });

    it('should reflect disabled state and apply disabled class', () => {
        host.disabled.set(true);
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
        expect(input.disabled).toBe(true);

        const wrapper = fixture.nativeElement.querySelector('.input-wrapper') as HTMLDivElement;
        expect(wrapper.classList.contains('input-disabled')).toBe(true);
    });

    it('should render error border and message when error string is provided', () => {
        host.error.set('Insufficient USDC balance');
        fixture.detectChanges();

        const wrapper = fixture.nativeElement.querySelector('.input-wrapper') as HTMLDivElement;
        expect(wrapper.classList.contains('input-error')).toBe(true);

        const errorMsg = fixture.nativeElement.querySelector('.input-error-msg');
        expect(errorMsg).toBeTruthy();
        expect(errorMsg.textContent?.trim()).toBe('Insufficient USDC balance');
        expect(errorMsg.getAttribute('role')).toBe('alert');
    });

    it('should apply monospace font class when variant is mono', () => {
        host.variant.set('mono');
        fixture.detectChanges();

        const wrapper = fixture.nativeElement.querySelector('.input-wrapper') as HTMLDivElement;
        expect(wrapper.classList.contains('input-variant-mono')).toBe(true);
    });

    it('should dynamically switch size classes', () => {
        const sizes: InputSize[] = ['sm', 'lg', 'default'];
        const wrapper = fixture.nativeElement.querySelector('.input-wrapper') as HTMLDivElement;

        for (const s of sizes) {
            host.size.set(s);
            fixture.detectChanges();
            expect(wrapper.classList.contains(`input-size-${s}`)).toBe(true);
        }
    });
});
