import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GlossaryPopoverComponent } from './glossary-popover.component';

describe('GlossaryPopoverComponent', () => {
    let fixture: ComponentFixture<GlossaryPopoverComponent>;
    let component: GlossaryPopoverComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GlossaryPopoverComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(GlossaryPopoverComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create and initially be closed', () => {
        expect(component).toBeTruthy();
        expect(component.isOpen()).toBe(false);
        const modal = fixture.nativeElement.querySelector('.dialog-portal');
        expect(modal).toBeNull();
    });

    it('should open modal when trigger button is clicked', () => {
        const triggerBtn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
        triggerBtn.click();
        fixture.detectChanges();

        expect(component.isOpen()).toBe(true);
        const modal = fixture.nativeElement.querySelector('.dialog-portal');
        expect(modal).toBeTruthy();
    });

    it('should display all 5 essential prediction market concepts in Grade 7-8 plain English', () => {
        component.open();
        fixture.detectChanges();

        const terms = fixture.nativeElement.querySelectorAll('.term-title');
        const termTitles = Array.from(terms).map((t: any) => t.textContent.trim());

        expect(termTitles).toContain('Automated Market Maker (AMM)');
        expect(termTitles).toContain('Constant Product Market Maker (CPMM)');
        expect(termTitles).toContain('Implied Probability');
        expect(termTitles).toContain('Slippage & Price Impact');
        expect(termTitles).toContain('Oracle Resolution');
    });

    it('should close when close() is invoked', () => {
        component.open();
        fixture.detectChanges();
        expect(component.isOpen()).toBe(true);

        component.close();
        fixture.detectChanges();
        expect(component.isOpen()).toBe(false);
    });
});
