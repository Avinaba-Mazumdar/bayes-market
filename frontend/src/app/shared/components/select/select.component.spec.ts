import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectComponent, SelectOption, SelectSize } from './select.component';

@Component({
    standalone: true,
    imports: [SelectComponent],
    template: `
        <app-select [options]="options()" [(value)]="selectedValue" [placeholder]="placeholder()" [disabled]="disabled()" [error]="error()" [size]="size()" />
        <div class="outside-element">Outside</div>
    `
})
class TestHostComponent {
    selectedValue = '';
    readonly placeholder = signal('Choose timeframe');
    readonly disabled = signal(false);
    readonly error = signal<string | boolean>('');
    readonly size = signal<SelectSize>('default');
    readonly options = signal<SelectOption[]>([
        { value: '1h', label: '1 Hour' },
        { value: '1d', label: '1 Day' },
        { value: '1w', label: '1 Week' },
        { value: 'all', label: 'All Time', disabled: true }
    ]);
}

describe('SelectComponent', () => {
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

    it('should render trigger button with placeholder when no value is selected', () => {
        const trigger = fixture.nativeElement.querySelector('.select-trigger') as HTMLButtonElement;
        expect(trigger).toBeTruthy();
        expect(trigger.textContent?.trim()).toContain('Choose timeframe');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('should open dropdown and show options on trigger click', () => {
        const trigger = fixture.nativeElement.querySelector('.select-trigger') as HTMLButtonElement;
        trigger.click();
        fixture.detectChanges();

        const dropdown = fixture.nativeElement.querySelector('.select-dropdown');
        expect(dropdown).toBeTruthy();
        expect(trigger.getAttribute('aria-expanded')).toBe('true');

        const options = fixture.nativeElement.querySelectorAll('.select-option');
        expect(options.length).toBe(4);
    });

    it('should select an option on click, update two-way bound model, and close dropdown', () => {
        const trigger = fixture.nativeElement.querySelector('.select-trigger') as HTMLButtonElement;
        trigger.click();
        fixture.detectChanges();

        const options = fixture.nativeElement.querySelectorAll('.select-option') as NodeListOf<HTMLDivElement>;
        // Click second option ('1 Day')
        options[1].click();
        fixture.detectChanges();

        expect(host.selectedValue).toBe('1d');
        expect(trigger.textContent?.trim()).toContain('1 Day');

        // Dropdown should be closed
        const dropdown = fixture.nativeElement.querySelector('.select-dropdown');
        expect(dropdown).toBeNull();
    });

    it('should not select a disabled option', () => {
        const trigger = fixture.nativeElement.querySelector('.select-trigger') as HTMLButtonElement;
        trigger.click();
        fixture.detectChanges();

        const options = fixture.nativeElement.querySelectorAll('.select-option') as NodeListOf<HTMLDivElement>;
        // Click 4th option ('All Time' which is disabled)
        options[3].click();
        fixture.detectChanges();

        expect(host.selectedValue).toBe('');
    });

    it('should handle keyboard navigation (ArrowDown, Enter, Escape)', () => {
        const trigger = fixture.nativeElement.querySelector('.select-trigger') as HTMLButtonElement;

        // Open with ArrowDown
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('.select-dropdown')).toBeTruthy();

        // Select first focused option with Enter
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        fixture.detectChanges();

        expect(host.selectedValue).toBe('1h');
        expect(fixture.nativeElement.querySelector('.select-dropdown')).toBeNull();

        // Reopen and close with Escape
        trigger.click();
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('.select-dropdown')).toBeTruthy();

        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('.select-dropdown')).toBeNull();
    });

    it('should close dropdown on outside click', () => {
        const trigger = fixture.nativeElement.querySelector('.select-trigger') as HTMLButtonElement;
        trigger.click();
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('.select-dropdown')).toBeTruthy();

        // Click outside element
        const outside = fixture.nativeElement.querySelector('.outside-element') as HTMLDivElement;
        outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('.select-dropdown')).toBeNull();
    });

    it('should display error message and apply error border', () => {
        host.error.set('Please select an expiration interval');
        fixture.detectChanges();

        const trigger = fixture.nativeElement.querySelector('.select-trigger') as HTMLButtonElement;
        expect(trigger.classList.contains('select-error')).toBe(true);

        const errorMsg = fixture.nativeElement.querySelector('.select-error-msg');
        expect(errorMsg).toBeTruthy();
        expect(errorMsg.textContent?.trim()).toBe('Please select an expiration interval');
    });
});
