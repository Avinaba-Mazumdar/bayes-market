import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopHeaderDockComponent } from './core/components/top-header-dock/top-header-dock.component';
import { ToastContainerComponent } from './shared/components/toast/toast-container.component';
import { AuthDialogComponent } from './features/auth/auth-dialog.component';

@Component({
    imports: [RouterOutlet, TopHeaderDockComponent, ToastContainerComponent, AuthDialogComponent],
    selector: 'app-root',
    changeDetection: ChangeDetectionStrategy.OnPush,
    styleUrl: './app.component.css',
    templateUrl: './app.component.html'
})
export class App {
    protected readonly title = signal('BayesMarket');
}
