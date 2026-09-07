import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TopHeaderDockComponent } from './top-header-dock.component';
import { WebSocketService } from '../../services/websocket.service';

describe('TopHeaderDockComponent', () => {
    let fixture: ComponentFixture<TopHeaderDockComponent>;
    let component: TopHeaderDockComponent;
    let wsService: WebSocketService;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TopHeaderDockComponent],
            providers: [provideRouter([]), WebSocketService]
        }).compileComponents();

        fixture = TestBed.createComponent(TopHeaderDockComponent);
        component = fixture.componentInstance;
        wsService = TestBed.inject(WebSocketService);
        fixture.detectChanges();
    });

    it('should render brand logo, navigation links, and balance pill', () => {
        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.brand-text')?.textContent).toContain('BayesMarket');
        expect(el.querySelector('.balance-amount')?.textContent).toContain('$1,000.00');

        const navTabs = el.querySelectorAll('.nav-tab');
        expect(navTabs.length).toBe(2);
        expect(navTabs[0].textContent?.trim()).toBe('Markets');
        expect(navTabs[1].textContent?.trim()).toBe('Portfolio');
    });

    it('should reflect live WebSocket connection status in telemetry pill', () => {
        const el = fixture.nativeElement as HTMLElement;
        const statusLabel = el.querySelector('.status-label');
        expect(statusLabel?.textContent?.trim()).toBe('OFFLINE');

        wsService.isConnected.set(true);
        fixture.detectChanges();
        expect(el.querySelector('.status-label')?.textContent?.trim()).toBe('LIVE');
        expect(el.querySelector('.status-dot.connected')).toBeTruthy();
    });

    it('should toggle live stream pause fulfilling WCAG 2.2 SC 2.2.4', () => {
        const el = fixture.nativeElement as HTMLElement;
        const pauseBtn = el.querySelector('.stream-toggle-btn') as HTMLButtonElement;
        expect(pauseBtn).toBeTruthy();
        expect(pauseBtn.textContent).toContain('Pause');

        pauseBtn.click();
        fixture.detectChanges();
        expect(wsService.isPaused()).toBe(true);
        expect(pauseBtn.textContent).toContain('Resume');
    });
});
