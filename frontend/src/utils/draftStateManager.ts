import { DraftState } from '@aquarium/shared-types';

export class DraftStateManager {
  private static readonly STORAGE_KEY = 'aquarium_draft_state';
  private static readonly COOKIE_NAME = 'aquarium_draft';
  private static readonly EXPIRES_HOURS = 24;

  // Save draft state to both localStorage and cookies for redundancy
  static saveDraftState(sessionId: string, draftState: DraftState): void {
    const dataToStore = {
      sessionId,
      draftState,
      timestamp: Date.now()
    };

    try {
      // Save to localStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToStore));
      
      // Save to cookie as backup
      this.setCookie(this.COOKIE_NAME, JSON.stringify(dataToStore), this.EXPIRES_HOURS);
    } catch (error) {
      console.warn('Failed to save draft state:', error);
    }
  }

  // Load draft state from localStorage or cookies
  static loadDraftState(sessionId: string): DraftState | null {
    try {
      // Try localStorage first
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.sessionId === sessionId && this.isValidDraftState(data.draftState)) {
          return data.draftState;
        }
      }

      // Fallback to cookies
      const cookieData = this.getCookie(this.COOKIE_NAME);
      if (cookieData) {
        const data = JSON.parse(cookieData);
        if (data.sessionId === sessionId && this.isValidDraftState(data.draftState)) {
          return data.draftState;
        }
      }
    } catch (error) {
      console.warn('Failed to load draft state:', error);
    }

    return null;
  }

  // Clear draft state from both storage methods
  static clearDraftState(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      this.deleteCookie(this.COOKIE_NAME);
    } catch (error) {
      console.warn('Failed to clear draft state:', error);
    }
  }

  // Check if draft state exists
  static hasDraftState(sessionId: string): boolean {
    return this.loadDraftState(sessionId) !== null;
  }

  // Get draft state age in minutes
  static getDraftStateAge(sessionId: string): number | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.sessionId === sessionId && data.timestamp) {
          return Math.floor((Date.now() - data.timestamp) / (1000 * 60));
        }
      }
    } catch (error) {
      console.warn('Failed to get draft state age:', error);
    }
    
    return null;
  }

  // Validate draft state structure
  private static isValidDraftState(draftState: any): boolean {
    return (
      draftState &&
      typeof draftState === 'object' &&
      Array.isArray(draftState.pieces) &&
      Array.isArray(draftState.grid) &&
      typeof draftState.lastModified === 'number'
    );
  }

  // Cookie helper methods
  private static setCookie(name: string, value: string, hours: number): void {
    const date = new Date();
    date.setTime(date.getTime() + (hours * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/;SameSite=Strict`;
  }

  private static getCookie(name: string): string | null {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  private static deleteCookie(name: string): void {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }
}