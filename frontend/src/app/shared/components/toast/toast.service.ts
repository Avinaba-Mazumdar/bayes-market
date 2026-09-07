import { Injectable, signal } from '@angular/core';
import { Toast, ToastVariant } from './toast.model';

export * from './toast.model';

@Injectable({
    providedIn: 'root'
})
export class ToastService {
    private readonly _toasts = signal<Toast[]>([]);
    readonly toasts = this._toasts.asReadonly();

    private idCounter = 0;

    show(params: Omit<Toast, 'id'>): string {
        const id = `toast-${++this.idCounter}-${Date.now()}`;
        const toast: Toast = {
            id,
            duration: 4500,
            variant: 'default',
            ...params
        };

        this._toasts.update((current) => [...current, toast]);

        if (toast.duration && toast.duration > 0) {
            setTimeout(() => {
                this.dismiss(id);
            }, toast.duration);
        }

        return id;
    }

    success(title: string, description?: string): string {
        return this.show({ title, description, variant: 'success' });
    }

    error(title: string, description?: string): string {
        return this.show({ title, description, variant: 'destructive' });
    }

    warning(title: string, description?: string): string {
        return this.show({ title, description, variant: 'warning' });
    }

    info(title: string, description?: string): string {
        return this.show({ title, description, variant: 'info' });
    }

    dismiss(id: string): void {
        this._toasts.update((current) => current.filter((t) => t.id !== id));
    }

    clear(): void {
        this._toasts.set([]);
    }
}
