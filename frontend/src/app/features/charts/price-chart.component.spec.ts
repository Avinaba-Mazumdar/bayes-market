import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PriceChartComponent } from './price-chart.component';
import { WebSocketService } from '../../core/services/websocket.service';

describe('PriceChartComponent', () => {
    let fixture: ComponentFixture<PriceChartComponent>;
    let component: PriceChartComponent;
    let wsService: WebSocketService;

    beforeAll(() => {
        // Ensure ResizeObserver is mocked in test environment if not present
        if (typeof window.ResizeObserver === 'undefined') {
            window.ResizeObserver = class {
                observe() {}
                unobserve() {}
                disconnect() {}
            } as any;
        }

        // Ensure canvas getContext returns dummy object in JSDOM
        if (!HTMLCanvasElement.prototype.getContext) {
            HTMLCanvasElement.prototype.getContext = (() => ({
                fillRect: () => {},
                clearRect: () => {},
                getImageData: () => ({ data: [] }),
                putImageData: () => {},
                createImageData: () => [],
                setTransform: () => {},
                drawImage: () => {},
                save: () => {},
                fillText: () => {},
                restore: () => {},
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                closePath: () => {},
                stroke: () => {},
                translate: () => {},
                scale: () => {},
                rotate: () => {},
                arc: () => {},
                fill: () => {},
                measureText: () => ({ width: 0 }),
                transform: () => {},
                rect: () => {},
                clip: () => {}
            })) as any;
        }
    });

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PriceChartComponent],
            providers: [WebSocketService]
        }).compileComponents();

        fixture = TestBed.createComponent(PriceChartComponent);
        component = fixture.componentInstance;
        wsService = TestBed.inject(WebSocketService);

        fixture.componentRef.setInput('marketId', '11111111-1111-1111-1111-111111111111');
        fixture.componentRef.setInput('initialProbabilityYes', 0.65);
        fixture.detectChanges();
    });

    it('should initialize with 65.0% probability and default timeframe 1D', () => {
        expect(component.formattedProbability()).toBe('65.0%');
        expect(component.selectedTimeframe()).toBe('1D');
    });

    it('should switch timeframe when chip is clicked', () => {
        component.selectTimeframe('1H');
        fixture.detectChanges();
        expect(component.selectedTimeframe()).toBe('1H');

        component.selectTimeframe('1W');
        fixture.detectChanges();
        expect(component.selectedTimeframe()).toBe('1W');

        component.selectTimeframe('ALL');
        fixture.detectChanges();
        expect(component.selectedTimeframe()).toBe('ALL');
    });

    it('should update price probability when WebSocket price tick arrives', () => {
        wsService.lastPriceTick.set({
            type: 'PRICE_UPDATE',
            market_id: '11111111-1111-1111-1111-111111111111',
            yes_price: '0.7200',
            no_price: '0.2800',
            timestamp: new Date().toISOString()
        });

        fixture.detectChanges();
        expect(component.formattedProbability()).toBe('72.0%');
    });

    it('should ignore WebSocket price ticks for different markets', () => {
        wsService.lastPriceTick.set({
            type: 'PRICE_UPDATE',
            market_id: '99999999-9999-9999-9999-999999999999',
            yes_price: '0.9000',
            no_price: '0.1000',
            timestamp: new Date().toISOString()
        });

        fixture.detectChanges();
        expect(component.formattedProbability()).toBe('65.0%');
    });
});
