import { HealthRequest, RequestStatus } from '../types';
import { storageService } from './storage';

const ESCALATION_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export const startEscalationWatcher = (
  onEscalate: (request: HealthRequest) => void
): (() => void) => {
  const check = () => {
    const now = Date.now();
    const requests = storageService.getRequests();
    requests.forEach(req => {
      if (req.status !== RequestStatus.PENDING) return;
      if (req.escalatedAt) return; // already escalated
      if (now - req.createdAt >= ESCALATION_THRESHOLD_MS) {
        storageService.markEscalated(req.id);
        onEscalate(req);
      }
    });
  };

  check(); // immediate check on mount
  const interval = setInterval(check, 30_000);
  return () => clearInterval(interval);
};

export const isEscalated = (request: HealthRequest): boolean => {
  if (request.escalatedAt) return true;
  if (request.status !== RequestStatus.PENDING) return false;
  return Date.now() - request.createdAt >= ESCALATION_THRESHOLD_MS;
};

export const elapsedMinutes = (createdAt: number): number => {
  return Math.floor((Date.now() - createdAt) / 60_000);
};
