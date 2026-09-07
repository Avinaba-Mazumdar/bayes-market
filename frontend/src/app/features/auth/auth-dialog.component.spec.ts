import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthDialogComponent } from './auth-dialog.component';
import { AuthStore } from '../../state/auth.store';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../shared/components/toast/toast.service';

describe('AuthDialogComponent', () => {
    let fixture: ComponentFixture<AuthDialogComponent>;
    let component: AuthDialogComponent;
    let authStore: AuthStore;
    let apiServiceSpy: {
        createGuestSession: any;
        verifyGoogleToken: any;
        getGoogleAuthUrl: any;
        getCurrentUser: any;
    };

    beforeEach(async () => {
        apiServiceSpy = {
            createGuestSession: vi.fn().mockReturnValue(
                of({
                    token: 'mock-guest-token',
                    user: {
                        id: 'guest-1',
                        email: null,
                        name: 'Guest Trader',
                        avatar_url: null,
                        auth_provider: 'guest',
                        cash_balance: '1000.00',
                        is_guest: true,
                        created_at: '2026-01-01T00:00:00Z'
                    }
                })
            ),
            verifyGoogleToken: vi.fn().mockReturnValue(
                of({
                    token: 'mock-google-token',
                    user: {
                        id: 'google-user-1',
                        email: 'trader@bayesmarket.com',
                        name: 'Alex Mercer',
                        avatar_url: 'https://example.com/avatar.jpg',
                        auth_provider: 'google',
                        cash_balance: '1250.00',
                        is_guest: false,
                        created_at: '2026-01-01T00:00:00Z'
                    }
                })
            ),
            getGoogleAuthUrl: vi.fn().mockReturnValue(
                of({
                    url: '',
                    simulated: true,
                    message: 'Simulated OAuth URL for dev environment'
                })
            ),
            getCurrentUser: vi.fn().mockReturnValue(
                of({
                    id: 'guest-1',
                    cash_balance: '1000.00',
                    is_guest: true,
                    created_at: '2026-01-01T00:00:00Z'
                })
            )
        };

        await TestBed.configureTestingModule({
            imports: [AuthDialogComponent],
            providers: [AuthStore, { provide: ApiService, useValue: apiServiceSpy }, ToastService]
        }).compileComponents();

        fixture = TestBed.createComponent(AuthDialogComponent);
        component = fixture.componentInstance;
        authStore = TestBed.inject(AuthStore);
        fixture.detectChanges();
    });

    it('should be hidden when isAuthModalOpen is false', () => {
        authStore.isAuthModalOpen.set(false);
        fixture.detectChanges();

        const dialogEl = fixture.nativeElement.querySelector('.dialog-portal');
        expect(dialogEl).toBeNull();
    });

    it('should display guest sign-in options when opened for a guest trader', () => {
        authStore.isAuthModalOpen.set(true);
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.upgrade-banner')).toBeTruthy();
        expect(el.querySelector('.upgrade-banner')?.textContent).toContain('Guest Session Active');

        const googleBtn = el.querySelector('.google-signin-btn') as HTMLButtonElement;
        expect(googleBtn).toBeTruthy();
        expect(googleBtn.textContent).toContain('Continue with Google');

        const devSignBtn = el.querySelector('.dev-box button');
        expect(devSignBtn).toBeTruthy();
        expect(devSignBtn?.textContent).toContain('Quick Dev Sign-In');
    });

    it('should execute dev quick login when clicked', () => {
        const loginSpy = vi.spyOn(authStore, 'loginWithGoogle');
        authStore.isAuthModalOpen.set(true);
        fixture.detectChanges();

        component.onDevQuickLogin();
        expect(loginSpy).toHaveBeenCalledWith('dev-mock-id-token-12345', 'trader@bayesmarket.com', 'Alex Mercer (Trader)');
    });

    it('should close dialog when continuing as guest', () => {
        authStore.isAuthModalOpen.set(true);
        fixture.detectChanges();

        component.continueAsGuest();
        expect(authStore.isAuthModalOpen()).toBe(false);
    });

    it('should render profile information and sign out button when logged in with Google', () => {
        authStore.user.set({
            id: 'google-user-1',
            email: 'trader@bayesmarket.com',
            name: 'Alex Mercer',
            avatar_url: 'https://example.com/avatar.jpg',
            auth_provider: 'google',
            cash_balance: '1250.00',
            is_guest: false,
            created_at: '2026-01-01T00:00:00Z'
        });
        authStore.isAuthModalOpen.set(true);
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.profile-name')?.textContent).toContain('Alex Mercer');
        expect(el.querySelector('.profile-email')?.textContent).toContain('trader@bayesmarket.com');
        expect(el.querySelector('.provider-badge')?.textContent).toContain('Google Verified');

        const logoutSpy = vi.spyOn(authStore, 'logout');
        component.onSignOut();
        expect(logoutSpy).toHaveBeenCalled();
        expect(authStore.isAuthModalOpen()).toBe(false);
    });
});
