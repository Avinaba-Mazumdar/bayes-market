import { Routes } from '@angular/router';
import { MarketListComponent } from './features/market/market-list.component';
import { MarketDetailComponent } from './features/market/market-detail.component';

export const routes: Routes = [
    {
        path: '',
        component: MarketListComponent,
        title: 'BayesMarket — Institutional Binary Prediction Market Exchange'
    },
    {
        path: 'markets/:id',
        component: MarketDetailComponent,
        title: 'Trading Cockpit — BayesMarket'
    },
    {
        path: '**',
        redirectTo: ''
    }
];
