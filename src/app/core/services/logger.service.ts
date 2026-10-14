import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';

// Single entry point for console output: log/warn are silenced in production, errors always go through
@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  log(message: string, ...args: unknown[]): void {
    if (!environment.production) {
      // eslint-disable-next-line no-console -- this service is the sanctioned wrapper around console
      console.log(message, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (!environment.production) {
      console.warn(message, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args);
  }
}
