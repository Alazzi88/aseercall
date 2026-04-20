import { useEffect, useRef } from 'react';
import { HealthRequest, RequestStatus } from '../types';
import { playTone, toneForPriority } from '../services/sound';
import { Language } from '../services/i18n';
import { hospitalLabel, pick } from '../services/i18n';

/**
 * Shared hook that watches for new PENDING requests and:
 * 1. Plays priority-based sound alert
 * 2. Vibrates device
 * 3. Sends browser notification
 *
 * Returns a setter so callers can clear the incoming notice message.
 */
export function useCallAlerts(
  requests: HealthRequest[],
  language: Language,
  onNewCalls?: (message: string) => void
): void {
  const initializedRef = useRef(false);
  const lastSeenCreatedAtRef = useRef(0);

  useEffect(() => {
    if (!requests.length && !initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    const latest = requests.reduce((max, r) => Math.max(max, r.createdAt), 0);

    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSeenCreatedAtRef.current = latest;
      return;
    }

    const freshRequests = requests.filter(
      req => req.status === RequestStatus.PENDING && req.createdAt > lastSeenCreatedAtRef.current
    );

    if (freshRequests.length > 0) {
      // Sort by priority to play the highest priority tone
      const topRequest = freshRequests.sort((a, b) => {
        const order: Record<string, number> = { EMERGENCY: 0, NURSE_CALL: 1, MEDICATION: 2, OTHER: 3 };
        return (order[a.priority ?? 'OTHER'] ?? 3) - (order[b.priority ?? 'OTHER'] ?? 3);
      })[0];

      playTone(toneForPriority(topRequest.priority));

      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }

      if (onNewCalls) {
        const namedHospital = hospitalLabel(topRequest.hospitalName, language);
        const message =
          freshRequests.length === 1
            ? pick(
                language,
                `نداء جديد من ${topRequest.patientName} — ${namedHospital} — غرفة ${topRequest.roomNumber} / سرير ${topRequest.bedNumber}`,
                `New call from ${topRequest.patientName} — ${namedHospital} — Room ${topRequest.roomNumber} / Bed ${topRequest.bedNumber}`
              )
            : pick(
                language,
                `${freshRequests.length} نداءات جديدة — ${namedHospital}`,
                `${freshRequests.length} new calls — ${namedHospital}`
              );
        onNewCalls(message);
      }

      // Browser notification
      if ('Notification' in window) {
        const title = pick(language, 'نداء جديد', 'New Call');
        const body = pick(
          language,
          `${topRequest.patientName} — غرفة ${topRequest.roomNumber}`,
          `${topRequest.patientName} — Room ${topRequest.roomNumber}`
        );
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
        } else if (Notification.permission === 'default') {
          Notification.requestPermission().then(perm => {
            if (perm === 'granted') new Notification(title, { body });
          });
        }
      }
    }

    if (latest > lastSeenCreatedAtRef.current) {
      lastSeenCreatedAtRef.current = latest;
    }
  }, [requests]);
}
