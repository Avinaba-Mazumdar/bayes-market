import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LabelComponent, LabelSize } from './label.component';

@Component({
    standalone: true,
    imports: [LabelComponent],
    template: ` <app-label [htmlFor]="htmlFor()" [required]="required()" [error]="error()" [disabled]="disabled()" [size]="size()"> Order Amount </app-label> `
})
class TestHostComponent {
    readonly htmlFor = signal('');
    readonly required = signal(false);
    readonly error = signal(false);
    readonly disabled = signal(false);
    readonly size = signal<LabelSize>('default');
}

describe('LabelComponent', () => {
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

    it('should render projected content with default size and attributes', () => {
        const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
        expect(label).toBeTruthy();
        expect(label.textContent?.trim()).toBe('Order Amount');
        expect(label.classList.contains('label-size-default')).toBe(true);
    });

    it('should bind for attribute when htmlFor is provided', () => {
        host.htmlFor.set('trade-amount-input');
        fixture.detectChanges();

        const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
        expect(label.getAttribute('for')).toBe('trade-amount-input');
    });

    it('should render required asterisk when required is true', () => {
        host.required.set(true);
        fixture.detectChanges();

        const indicator = fixture.nativeElement.querySelector('.required-indicator');
        expect(indicator).toBeTruthy();
        expect(indicator.textContent?.trim()).toBe('*');
    });

    it('should apply error class when error is true', () => {
        host.error.set(true);
        fixture.detectChanges();

        const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
        expect(label.classList.contains('label-error')).toBe(true);
    });

    it('should apply disabled class when disabled is true', () => {
        host.disabled.set(true);
        fixture.detectChanges();

        const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
        expect(label.classList.contains('label-disabled')).toBe(true);
    });

    it('should dynamically switch size classes', () => {
        const sizes: LabelSize[] = ['sm', 'lg', 'default'];
        const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;

        for (const s of sizes) {
            host.size.set(s);
            fixture.detectChanges();
            expect(label.classList.contains(`label-size-${s}`)).toBe(true);
        }
    });
});
