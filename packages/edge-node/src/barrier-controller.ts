/**
 * barrier-controller.ts — Physical barrier control for Parkly Edge Node
 *
 * Communicates with the barrier hardware over HTTP.
 * Implements retry logic and offline fallback behavior.
 */

import axios from 'axios';

export type BarrierCommand = 'OPEN' | 'CLOSE' | 'PULSE';
export type BarrierResponse = {
  success: boolean;
  error?: string;
  barrierState?: string;
};

type BarrierControllerDeps = {
  barrierEndpoint: string;
  commandTimeoutMs?: number;
};

export class BarrierController {
  private readonly endpoint: string;
  private readonly timeout: number;
  private readonly http = axios.create();

  private retryCount = 0;
  private readonly maxRetries = 3;

  constructor(deps: BarrierControllerDeps) {
    this.endpoint = deps.barrierEndpoint;
    this.timeout = deps.commandTimeoutMs ?? 5_000;
  }

  private async sendCommand(cmd: BarrierCommand): Promise<BarrierResponse> {
    try {
      const response = await this.http.post<{ success: boolean; error?: string; state?: string }>(
        `${this.endpoint}/command`,
        { command: cmd },
        { timeout: this.timeout },
      );
      return {
        success: response.data.success ?? true,
        error: response.data.error,
        barrierState: response.data.state,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  /**
   * openBarrier — sends OPEN command to barrier hardware.
   * Retries up to maxRetries times on failure.
   */
  async openBarrier(laneCode: string, reason?: string): Promise<BarrierResponse> {
    console.log(`[barrier] OPEN lane=${laneCode} reason=${reason ?? 'auto'}`);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const result = await this.sendCommand('OPEN');

      if (result.success) {
        this.retryCount = 0;
        console.log(`[barrier] OPEN success lane=${laneCode} attempt=${attempt}`);
        return result;
      }

      console.warn(`[barrier] OPEN failed lane=${laneCode} attempt=${attempt} error=${result.error}`);

      if (attempt < this.maxRetries) {
        await sleep(200 * attempt); // exponential backoff
      }
    }

    // All retries exhausted — log incident and alert
    console.error(`[barrier] OPEN all retries exhausted lane=${laneCode}`);
    this.retryCount++;

    return {
      success: false,
      error: `Barrier unresponsive after ${this.maxRetries} attempts`,
    };
  }

  /**
   * openBarrierFireAndForget — best-effort barrier open.
   * Does not block if barrier is unreachable.
   */
  async openBarrierFireAndForget(laneCode: string, reason?: string): Promise<void> {
    // Don't await — fire and forget
    this.openBarrier(laneCode, reason).catch((err) => {
      console.error(`[barrier] Fire-and-forget failed:`, err);
    });
  }

  /**
   * pulseBarrier — briefly opens barrier for 1 pulse cycle.
   * Used for maintenance/testing.
   */
  async pulseBarrier(laneCode: string): Promise<BarrierResponse> {
    console.log(`[barrier] PULSE lane=${laneCode}`);
    return this.sendCommand('PULSE');
  }

  /**
   * closeBarrier — sends CLOSE command to barrier hardware.
   */
  async closeBarrier(laneCode: string): Promise<BarrierResponse> {
    console.log(`[barrier] CLOSE lane=${laneCode}`);
    return this.sendCommand('CLOSE');
  }

  isHealthy(): boolean {
    return this.retryCount < 5;
  }

  getRetryCount(): number {
    return this.retryCount;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
