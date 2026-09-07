import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TopHeaderDockComponent } from './top-header-dock.component';
import { WebSocketService } from '../../services/websocket.service';
import { AuthStore } from '../../../state/auth.store';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../../shared/components/toast/toast.service';

describe('TopHeaderDockComponent', () => {
    let fixture: ComponentFixture<TopHeaderDockComponent>;
    let component: TopHeaderDockComponent;
    let wsService: WebSocketService;
    let authStore: AuthStore;
    let apiServiceSpy: any;

    beforeEach(async () => {
        apiServiceSpy = {
            createGuestSession: vi.fn().mockReturnValue(
                of({
                    token: 'guest-tok',
                    user: {
                        id: 'u-1',
                        cash_balance: '1000.00',
                        is_guest: true,
                        created_at: '2026-01-01T00:00:00Z'
                    }
                })
            ),
            getCurrentUser: vi.fn().mockReturnValue(
                of({
                    id: 'u-1',
                    cash_balance: '1000.00',
                    is_guest: true,
                    created_at: '2026-01-01T00:00:00Z'
                })
            ),
            getGoogleAuthUrl: vi.fn().mockReturnValue(of({ url: '', simulated: true }))
        };

        await TestBed.configureTestingModule({
            imports: [TopHeaderDockComponent],
            providers: [provideRouter([]), WebSocketService, AuthStore, { provide: ApiService, useValue: apiServiceSpy }, ToastService]
        }).compileComponents();

        fixture = TestBed.createComponent(TopHeaderDockComponent);
        component = fixture.componentInstance;
        wsService = TestBed.inject(WebSocketService);
        authStore = TestBed.inject(AuthStore);
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

    it('should show Sign In button for guest trader and open auth modal on click', () => {
        const el = fixture.nativeElement as HTMLElement;
        const signInBtn = el.querySelector('.guest-badge-btn') as HTMLButtonElement;
        expect(signInBtn).toBeTruthy();
        expect(signInBtn.textContent).toContain('Sign In');

        signInBtn.click();
        expect(authStore.isAuthModalOpen()).toBe(true);
    });

    it('should show user profile and sign out button when logged in with Google', () => {
        authStore.user.set({
            id: 'google-1',
            email: 'trader@bayesmarket.com',
            name: 'Alex Mercer',
            avatar_url: null,
            auth_provider: 'google',
            cash_balance: '2500.00',
            is_guest: false,
            created_at: '2026-01-01T00:00:00Z'
        });
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.guest-badge-btn')).toBeNull();
        expect(el.querySelector('.user-profile-dock')).toBeTruthy();
        expect(el.querySelector('.auth-user-name')?.textContent).toContain('Alex Mercer');

        const signOutBtn = el.querySelector('.signout-quick-btn') as HTMLButtonElement;
        expect(signOutBtn).toBeTruthy();
        const logoutSpy = vi.spyOn(authStore, 'logout');
        signOutBtn.click();
        expect(logoutSpy).toHaveBeenCalled();
    });
});
