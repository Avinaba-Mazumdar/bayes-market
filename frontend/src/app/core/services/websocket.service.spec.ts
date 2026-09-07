import { TestBed } from '@angular/core/testing';
import { WebSocketService } from './websocket.service';
import { PriceUpdateEvent, TradeEvent } from '../models/websocket.model';

describe('WebSocketService', () => {
  let service: WebSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WebSocketService],
    });
    service = TestBed.inject(WebSocketService);
  });

  afterEach(() => {
    service.disconnect();
  });

  it('should initialize with disconnected state and unpaused stream', () => {
    expect(service.isConnected()).toBe(false);
    expect(service.connectionStatus()).toBe('disconnected');
    expect(service.isPaused()).toBe(false);
    expect(service.lastPriceTick()).toBeNull();
    expect(service.recentTrades().length).toBe(0);
  });

  it('should toggle pause state fulfilling WCAG 2.2 SC 2.2.4 (Interruptions)', () => {
    expect(service.isPaused()).toBe(false);

    const paused = service.togglePause();
    expect(paused).toBe(true);
    expect(service.isPaused()).toBe(true);

    const resumed = service.togglePause();
    expect(resumed).toBe(false);
    expect(service.isPaused()).toBe(false);
  });

  it('should update signals on incoming messages when not paused', () => {
    const mockPriceUpdate: PriceUpdateEvent = {
      type: 'PRICE_UPDATE',
      market_id: 'test-market-id',
      yes_price: '0.72000000',
      no_price: '0.28000000',
      total_volume_usdc: '1000.00000000',
      timestamp: '2026-09-07T00:00:00Z',
    };

    // Access private message handler for controlled unit testing
    (service as unknown as { handleIncomingMessage: (raw: string) => void }).handleIncomingMessage(
      JSON.stringify(mockPriceUpdate)
    );

    expect(service.lastPriceTick()).toEqual(mockPriceUpdate);

    const mockTrade: TradeEvent = {
      type: 'TRADE_EVENT',
      trade_id: 't-1',
      market_id: 'test-market-id',
      trade_type: 'BUY',
      outcome: 'YES',
      shares: '100.00000000',
      price: '0.72000000',
      amount_usdc: '72.00000000',
      timestamp: '2026-09-07T00:00:00Z',
    };

    (service as unknown as { handleIncomingMessage: (raw: string) => void }).handleIncomingMessage(
      JSON.stringify(mockTrade)
    );

    expect(service.recentTrades().length).toBe(1);
    expect(service.recentTrades()[0]).toEqual(mockTrade);
  });

  it('should suppress signal updates when stream is paused', () => {
    service.setPaused(true);

    const mockPriceUpdate: PriceUpdateEvent = {
      type: 'PRICE_UPDATE',
      market_id: 'test-market-id',
      yes_price: '0.85000000',
      no_price: '0.15000000',
      timestamp: '2026-09-07T00:00:00Z',
    };

    (service as unknown as { handleIncomingMessage: (raw: string) => void }).handleIncomingMessage(
      JSON.stringify(mockPriceUpdate)
    );

    // Should remain null because updates are suppressed while paused
    expect(service.lastPriceTick()).toBeNull();
  });
});
