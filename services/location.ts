import { HOSPITALS } from '../types';

export interface LiveLocation {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface HospitalFence {
  lat: number;
  lng: number;
  radiusMeters: number;
}

export interface LocationAccessResult {
  allowed: boolean;
  reason: string;
  hospitalName?: string;
  distanceMeters?: number;
}

const EARTH_RADIUS_METERS = 6371000;
const HOSPITAL_FENCES_KEY = 'aseer_hospital_fences_override';

// Base coordinates. Admin can override any hospital position from dashboard using live GPS.
const DEFAULT_HOSPITAL_FENCES: Record<string, HospitalFence> = {
  'مستشفى أبها للولادة والأطفال': { lat: 18.2261, lng: 42.5145, radiusMeters: 1800 },
  'مستشفى عسير المركزي': { lat: 18.2267, lng: 42.5053, radiusMeters: 1800 },
  'مستشفى خميس مشيط العام': { lat: 18.3061, lng: 42.7291, radiusMeters: 1800 },
  'مستشفى محايل العام': { lat: 18.5463, lng: 42.0451, radiusMeters: 2000 },
  'مستشفى الصحة النفسية بأبها': { lat: 18.2398, lng: 42.5748, radiusMeters: 1800 },
  'مستشفى أحد رفيدة العام': { lat: 18.1960, lng: 42.9420, radiusMeters: 2200 },
  'مستشفى سراة عبيدة العام': { lat: 18.0348, lng: 42.8205, radiusMeters: 2200 },
  'مستشفى رجال ألمع العام': { lat: 18.1895, lng: 42.2230, radiusMeters: 2200 },
  'مستشفى النماص العام': { lat: 19.1451, lng: 42.1243, radiusMeters: 2400 },
  'مستشفى بللسمر العام': { lat: 18.3121, lng: 42.5468, radiusMeters: 2200 }
};

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const isValidFence = (value: any): value is HospitalFence => {
  return (
    value &&
    typeof value.lat === 'number' &&
    Number.isFinite(value.lat) &&
    typeof value.lng === 'number' &&
    Number.isFinite(value.lng) &&
    typeof value.radiusMeters === 'number' &&
    Number.isFinite(value.radiusMeters) &&
    value.radiusMeters > 100
  );
};

const getStoredHospitalFences = (): Record<string, HospitalFence> => {
  if (typeof window === 'undefined') return {};
  const rows = safeParse<Record<string, HospitalFence>>(localStorage.getItem(HOSPITAL_FENCES_KEY), {});

  const cleaned: Record<string, HospitalFence> = {};
  for (const [hospitalName, fence] of Object.entries(rows)) {
    if (isValidFence(fence)) {
      cleaned[hospitalName] = fence;
    }
  }
  return cleaned;
};

const saveStoredHospitalFences = (fences: Record<string, HospitalFence>) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HOSPITAL_FENCES_KEY, JSON.stringify(fences));
  window.dispatchEvent(new Event('storage'));
};

export const getHospitalFences = (): Record<string, HospitalFence> => {
  return {
    ...DEFAULT_HOSPITAL_FENCES,
    ...getStoredHospitalFences()
  };
};

export const getHospitalFence = (hospitalName: string): HospitalFence | null => {
  return getHospitalFences()[hospitalName] || null;
};

export const setHospitalFenceToLocation = (
  hospitalName: string,
  location: Pick<LiveLocation, 'lat' | 'lng'>,
  radiusMeters?: number
): HospitalFence | null => {
  if (!HOSPITALS.includes(hospitalName)) return null;

  const current = getHospitalFence(hospitalName);
  const nextFence: HospitalFence = {
    lat: location.lat,
    lng: location.lng,
    radiusMeters:
      typeof radiusMeters === 'number' && Number.isFinite(radiusMeters) && radiusMeters > 100
        ? radiusMeters
        : current?.radiusMeters || 1800
  };

  const stored = getStoredHospitalFences();
  stored[hospitalName] = nextFence;
  saveStoredHospitalFences(stored);

  return nextFence;
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const distanceMeters = (
  from: Pick<LiveLocation, 'lat' | 'lng'>,
  to: Pick<LiveLocation, 'lat' | 'lng'>
): number => {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
};

export const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)} م`;
  return `${(meters / 1000).toFixed(2)} كم`;
};

export const evaluateHospitalAccess = (
  location: LiveLocation | null,
  hospitalName: string
): LocationAccessResult => {
  if (!location) {
    return {
      allowed: false,
      hospitalName,
      reason: 'تعذر تحديد موقعك الحالي. فعّل خدمة الموقع (GPS) وحاول مرة أخرى.'
    };
  }

  const hospitalFence = getHospitalFence(hospitalName);
  if (!hospitalFence) {
    return {
      allowed: false,
      hospitalName,
      reason: 'إحداثيات المستشفى غير مهيأة حالياً. تواصل مع مدير النظام.'
    };
  }

  const distance = distanceMeters(location, hospitalFence);
  if (distance <= hospitalFence.radiusMeters) {
    return {
      allowed: true,
      hospitalName,
      distanceMeters: distance,
      reason: `أنت داخل نطاق ${hospitalName}`
    };
  }

  return {
    allowed: false,
    hospitalName,
    distanceMeters: distance,
    reason: `أنت خارج نطاق ${hospitalName}. المسافة الحالية ${formatDistance(distance)}.`
  };
};

export const evaluateAnyHospitalAccess = (location: LiveLocation | null): LocationAccessResult => {
  if (!location) {
    return {
      allowed: false,
      reason: 'تعذر تحديد موقعك الحالي. فعّل خدمة الموقع (GPS) وحاول مرة أخرى.'
    };
  }

  const checks = HOSPITALS.map(hospitalName => evaluateHospitalAccess(location, hospitalName)).filter(
    check => typeof check.distanceMeters === 'number'
  );

  const inside = checks.find(check => check.allowed);
  if (inside) {
    return {
      allowed: true,
      hospitalName: inside.hospitalName,
      distanceMeters: inside.distanceMeters,
      reason: `تم التحقق من وجودك داخل ${inside.hospitalName}`
    };
  }

  const nearest = checks.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0))[0];
  if (!nearest) {
    return {
      allowed: false,
      reason: 'تعذر التحقق من موقعك بالنسبة للمستشفيات.'
    };
  }

  return {
    allowed: false,
    hospitalName: nearest.hospitalName,
    distanceMeters: nearest.distanceMeters,
    reason: `يجب أن تكون داخل نطاق أحد المستشفيات. أقرب مستشفى لك ${nearest.hospitalName} (${formatDistance(
      nearest.distanceMeters || 0
    )}).`
  };
};

const encode = (value: string): string => encodeURIComponent(value);

export const buildOpenStreetMapEmbedUrl = (
  lat: number,
  lng: number,
  delta = 0.015
): string => {
  const left = lng - delta;
  const right = lng + delta;
  const top = lat + delta;
  const bottom = lat - delta;
  const bbox = `${left},${bottom},${right},${top}`;
  const marker = `${lat},${lng}`;

  return `https://www.openstreetmap.org/export/embed.html?bbox=${encode(bbox)}&layer=mapnik&marker=${encode(marker)}`;
};

export const buildGoogleMapsLink = (lat: number, lng: number): string => {
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

export const getHospitalCoordinates = (hospitalName: string): Pick<LiveLocation, 'lat' | 'lng'> | null => {
  const fence = getHospitalFence(hospitalName);
  if (!fence) return null;
  return { lat: fence.lat, lng: fence.lng };
};
