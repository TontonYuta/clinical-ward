/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Smooth Token Stream Buffer Engine for Clinical Ward Copilot
 * Cung cấp luồng truyền phát Typewriter mượt mà 50-60 FPS,
 * hấp thụ hoàn toàn độ trễ / giật cục (jitter & burstiness) từ TCP và mạng.
 */

export class SmoothStreamBuffer {
  private targetText = '';
  private displayedText = '';
  private isFinished = false;
  private onToken: (chunk: string, currentFullText: string) => void;
  private timer: ReturnType<typeof setInterval> | null = null;
  private resolveDone?: () => void;

  constructor(onToken: (chunk: string, currentFullText: string) => void) {
    this.onToken = onToken;
  }

  public push(chunk: string) {
    if (!chunk) return;
    this.targetText += chunk;
    this.startTicking();
  }

  public finish(): Promise<void> {
    this.isFinished = true;
    this.startTicking();
    if (this.displayedText.length >= this.targetText.length) {
      this.cleanup();
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.resolveDone = resolve;
    });
  }

  public stop() {
    this.cleanup();
  }

  private startTicking() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 18); // ~55 FPS
  }

  private cleanup() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.resolveDone) {
      this.resolveDone();
      this.resolveDone = undefined;
    }
  }

  private tick() {
    const diff = this.targetText.length - this.displayedText.length;
    if (diff <= 0) {
      if (this.isFinished) {
        this.cleanup();
      }
      return;
    }

    // Tự thích ứng nhịp hiển thị (Adaptive cadence)
    let step: number;
    if (this.isFinished) {
      // Khi backend đã gửi xong: tăng tốc xả mượt trong ~120ms
      step = Math.max(3, Math.ceil(diff / 4));
    } else if (diff > 120) {
      // Bị trễ nhiều do network burst: bắt kịp mượt mà
      step = Math.ceil(diff / 6);
    } else if (diff > 50) {
      step = 4;
    } else if (diff > 20) {
      step = 2;
    } else {
      step = 1;
    }

    const nextChars = this.targetText.slice(
      this.displayedText.length,
      this.displayedText.length + step
    );
    this.displayedText += nextChars;
    this.onToken(nextChars, this.displayedText);

    if (this.displayedText.length >= this.targetText.length && this.isFinished) {
      this.cleanup();
    }
  }
}
