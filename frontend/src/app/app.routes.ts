import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./features/market/market-list.component').then((m) => m.MarketListComponent),
        title: 'BayesMarket — Institutional Binary Prediction Market Exchange'
    },
    {
        path: 'markets/:id',
        loadComponent: () => import('./features/market/market-detail.component').then((m) => m.MarketDetailComponent),
        title: 'Trading Cockpit — BayesMarket'
    },
    {
        path: 'portfolio',
        loadComponent: () => import('./features/portfolio/portfolio-view.component').then((m) => m.PortfolioViewComponent),
        title: 'Portfolio & PnL Ledger — BayesMarket'
    },
    {
        path: '**',
        redirectTo: ''
    }
];
