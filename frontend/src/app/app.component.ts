import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopHeaderDockComponent } from './core/components/top-header-dock/top-header-dock.component';
import { ToastContainerComponent } from './shared/components/toast/toast-container.component';

@Component({
    imports: [RouterOutlet, TopHeaderDockComponent, ToastContainerComponent],
    selector: 'app-root',
    styleUrl: './app.component.css',
    templateUrl: './app.component.html'
})
export class App {
    protected readonly title = signal('BayesMarket');
}
