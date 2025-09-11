// Session timeout utility for 10-minute inactivity logout
export class SessionTimeout {
  private timeoutId: NodeJS.Timeout | null = null;
  private readonly timeoutDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
  private onTimeout: () => void;
  private isActive = false;

  constructor(onTimeoutCallback: () => void) {
    this.onTimeout = onTimeoutCallback;
  }

  // Start the session timeout
  start() {
    if (this.isActive) return;
    
    this.isActive = true;
    this.resetTimer();
    this.addEventListeners();
  }

  // Stop the session timeout
  stop() {
    this.isActive = false;
    this.clearTimer();
    this.removeEventListeners();
  }

  // Reset the timer (called on user activity)
  private resetTimer = () => {
    this.clearTimer();
    this.timeoutId = setTimeout(() => {
      this.handleTimeout();
    }, this.timeoutDuration);
  };

  // Clear the current timer
  private clearTimer() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  // Handle timeout event
  private handleTimeout() {
    this.stop();
    this.onTimeout();
  }

  // Add event listeners for user activity
  private addEventListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, this.resetTimer, true);
    });

    // Also listen for API calls (fetch requests)
    this.interceptFetch();
  }

  // Remove event listeners
  private removeEventListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.removeEventListener(event, this.resetTimer, true);
    });
  }

  // Intercept fetch requests to reset timer on API activity
  private interceptFetch() {
    const originalFetch = window.fetch;
    window.fetch = (...args) => {
      if (this.isActive) {
        this.resetTimer();
      }
      return originalFetch(...args);
    };
  }
}

// Global session timeout instance
let sessionTimeoutInstance: SessionTimeout | null = null;

export const initializeSessionTimeout = (onTimeout: () => void) => {
  if (sessionTimeoutInstance) {
    sessionTimeoutInstance.stop();
  }
  
  sessionTimeoutInstance = new SessionTimeout(onTimeout);
  sessionTimeoutInstance.start();
};

export const stopSessionTimeout = () => {
  if (sessionTimeoutInstance) {
    sessionTimeoutInstance.stop();
    sessionTimeoutInstance = null;
  }
};
