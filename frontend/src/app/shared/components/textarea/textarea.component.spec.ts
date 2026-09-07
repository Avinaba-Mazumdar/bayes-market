import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextareaComponent, TextareaSize, TextareaVariant } from './textarea.component';

@Component({
    standalone: true,
    imports: [TextareaComponent],
    template: `
        <app-textarea [(value)]="textVal" [placeholder]="placeholder()" [disabled]="disabled()" [error]="error()" [size]="size()" [variant]="variant()" />
    `
})
class TestHostComponent {
    textVal = '';
    readonly placeholder = signal('Market resolution details...');
    readonly disabled = signal(false);
    readonly error = signal<string | boolean>('');
    readonly size = signal<TextareaSize>('default');
    readonly variant = signal<TextareaVariant>('default');
}

describe('TextareaComponent', () => {
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

    it('should render native textarea with placeholder and default size', () => {
        const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
        expect(textarea).toBeTruthy();
        expect(textarea.placeholder).toBe('Market resolution details...');

        const wrapper = fixture.nativeElement.querySelector('.textarea-wrapper') as HTMLDivElement;
        expect(wrapper.classList.contains('textarea-size-default')).toBe(true);
    });

    it('should update two-way bound model value on user input', () => {
        const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
        textarea.value = 'Resolution source: Associated Press';
        textarea.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        expect(host.textVal).toBe('Resolution source: Associated Press');
    });

    it('should reflect disabled state and apply disabled class', () => {
        host.disabled.set(true);
        fixture.detectChanges();

        const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
        expect(textarea.disabled).toBe(true);

        const wrapper = fixture.nativeElement.querySelector('.textarea-wrapper') as HTMLDivElement;
        expect(wrapper.classList.contains('textarea-disabled')).toBe(true);
    });

    it('should display error message and error border when error is provided', () => {
        host.error.set('Description must be at least 20 characters');
        fixture.detectChanges();

        const wrapper = fixture.nativeElement.querySelector('.textarea-wrapper') as HTMLDivElement;
        expect(wrapper.classList.contains('textarea-error')).toBe(true);

        const errorMsg = fixture.nativeElement.querySelector('.textarea-error-msg');
        expect(errorMsg).toBeTruthy();
        expect(errorMsg.textContent?.trim()).toBe('Description must be at least 20 characters');
        expect(errorMsg.getAttribute('role')).toBe('alert');
    });

    it('should apply mono variant class when specified', () => {
        host.variant.set('mono');
        fixture.detectChanges();

        const wrapper = fixture.nativeElement.querySelector('.textarea-wrapper') as HTMLDivElement;
        expect(wrapper.classList.contains('textarea-variant-mono')).toBe(true);
    });

    it('should dynamically switch size classes', () => {
        const sizes: TextareaSize[] = ['sm', 'lg', 'default'];
        const wrapper = fixture.nativeElement.querySelector('.textarea-wrapper') as HTMLDivElement;

        for (const s of sizes) {
            host.size.set(s);
            fixture.detectChanges();
            expect(wrapper.classList.contains(`textarea-size-${s}`)).toBe(true);
        }
    });
});
