import React, { useMemo } from 'react';
import {
  LiveLocation,
  LocationAccessResult,
  buildGoogleMapsLink,
  buildOpenStreetMapEmbedUrl,
  evaluateAnyHospitalAccess,
  evaluateHospitalAccess,
  formatDistance,
  getHospitalCoordinates
} from '../services/location';
import { Language, hospitalLabel, pick } from '../services/i18n';

interface LocationStatusCardProps {
  location: LiveLocation | null;
  locationError?: string;
  hospitalName?: string;
  title?: string;
  showRangeStatus?: boolean;
  language?: Language;
  hideTitle?: boolean;
}

const StatusBadge: React.FC<{ access: LocationAccessResult; language: Language }> = ({
  access,
  language
}) => (
  <span
    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold gap-1.5 ${
      access.allowed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
    }`}
  >
    <span
      className={`h-2 w-2 rounded-full ${access.allowed ? 'bg-emerald-500' : 'bg-red-500'}`}
      aria-hidden
    />
    {access.allowed
      ? pick(language, 'داخل النطاق', 'Inside range')
      : pick(language, 'خارج النطاق', 'Outside range')}
  </span>
);

const LocationStatusCard: React.FC<LocationStatusCardProps> = ({
  location,
  locationError,
  hospitalName,
  title,
  showRangeStatus = false,
  language = 'ar',
  hideTitle = false
}) => {
  const isEnglish = language === 'en';
  const resolvedTitle = title || pick(language, 'الموقع الجغرافي المباشر', 'Live Location');

  const formatDistanceByLanguage = (meters: number): string => {
    if (isEnglish) {
      if (meters < 1000) return `${Math.round(meters)} m`;
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return formatDistance(meters);
  };

  const access = useMemo(() => {
    if (!showRangeStatus) return null;
    if (hospitalName) return evaluateHospitalAccess(location, hospitalName);
    return evaluateAnyHospitalAccess(location);
  }, [hospitalName, location, showRangeStatus]);

  const accessMessage = useMemo(() => {
    if (!showRangeStatus) {
      return pick(
        language,
        'عرض الموقع المباشر فقط بدون التحقق من نطاق المستشفى.',
        'Live location is shown without hospital-range verification.'
      );
    }

    if (!location) {
      return pick(
        language,
        'تعذر تحديد موقعك الحالي. فعّل خدمة الموقع (GPS) وحاول مرة أخرى.',
        'Unable to detect your current location. Enable GPS and try again.'
      );
    }

    if (!access) {
      return pick(language, 'تعذر التحقق من نطاق المستشفى.', 'Unable to verify hospital range.');
    }

    if (access.allowed) {
      if (access.hospitalName) {
        const namedHospital = hospitalLabel(access.hospitalName, language);
        return pick(
          language,
          `أنت داخل نطاق ${namedHospital}`,
          `You are inside ${namedHospital} range.`
        );
      }
      return pick(language, 'أنت داخل النطاق المسموح.', 'You are inside the allowed range.');
    }

    if (access.hospitalName && typeof access.distanceMeters === 'number') {
      const namedHospital = hospitalLabel(access.hospitalName, language);
      return pick(
        language,
        `أنت خارج نطاق ${namedHospital}. المسافة الحالية ${formatDistanceByLanguage(access.distanceMeters)}.`,
        `You are outside ${namedHospital} range. Current distance: ${formatDistanceByLanguage(access.distanceMeters)}.`
      );
    }

    return pick(language, 'أنت خارج النطاق المسموح حالياً.', 'You are currently outside the allowed range.');
  }, [access, language, location, showRangeStatus]);

  const mapUrl = location ? buildOpenStreetMapEmbedUrl(location.lat, location.lng) : '';
  const mapsLink = location ? buildGoogleMapsLink(location.lat, location.lng) : '';
  const hospitalCoords = hospitalName ? getHospitalCoordinates(hospitalName) : null;
  const lastUpdateLabel = location
    ? new Date(location.timestamp).toLocaleTimeString(isEnglish ? 'en-US' : 'ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    : '';

  return (
    <div className="relative panel-glass motion-card rounded-[1.6rem] p-5 md:p-6 overflow-hidden animate-fade-up animate-delay-3">
      <div className="absolute -top-16 -left-10 h-36 w-36 rounded-full bg-sky-200/40 blur-2xl pointer-events-none" />

      <div
        className={`relative flex items-center mb-3 gap-3 ${
          hideTitle ? 'justify-end' : 'justify-between'
        }`}
      >
        {!hideTitle && <h4 className="font-black text-sm text-slate-900">{resolvedTitle}</h4>}
        {access ? (
          <StatusBadge access={access} language={language} />
        ) : (
          <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold bg-slate-100 text-slate-700">
            {pick(language, 'بدون نطاق', 'No range')}
          </span>
        )}
      </div>

      <p
        className={`relative text-xs font-semibold ${
          access ? (access.allowed ? 'text-emerald-700' : 'text-red-600') : 'text-slate-600'
        }`}
      >
        {accessMessage}
      </p>

      {locationError && (
        <p className="relative text-xs text-red-600 mt-3 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {locationError}
        </p>
      )}

      {location ? (
        <>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="surface-divider rounded-xl p-3">
              <p className="text-slate-500 font-semibold">
                {pick(language, 'الإحداثيات', 'Coordinates')}
              </p>
              <p className="text-slate-800 font-black mt-1 text-[11px]">
                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </p>
            </div>
            <div className="surface-divider rounded-xl p-3">
              <p className="text-slate-500 font-semibold">{pick(language, 'دقة GPS', 'GPS Accuracy')}</p>
              <p className="text-slate-800 font-black mt-1">
                {Math.round(location.accuracy)} {pick(language, 'متر', 'm')}
              </p>
            </div>
            <div className="surface-divider rounded-xl p-3">
              <p className="text-slate-500 font-semibold">{pick(language, 'آخر تحديث', 'Last update')}</p>
              <p className="text-slate-800 font-black mt-1">{lastUpdateLabel}</p>
            </div>
            <div className="surface-divider rounded-xl p-3">
              <p className="text-slate-500 font-semibold">{pick(language, 'المسافة للنطاق', 'Distance to range')}</p>
              <p className="text-slate-800 font-black mt-1">
                {access && typeof access.distanceMeters === 'number'
                  ? formatDistanceByLanguage(access.distanceMeters)
                  : pick(language, 'غير متوفر', 'Unavailable')}
              </p>
            </div>
          </div>

          {hospitalCoords && (
            <p className="mt-3 text-xs text-slate-600">
              {pick(language, 'إحداثيات المستشفى:', 'Hospital coordinates:')}
              {hospitalName ? ` ${hospitalLabel(hospitalName, language)} ` : ' '}
              <span className="font-bold text-slate-800">
                {hospitalCoords.lat.toFixed(6)}, {hospitalCoords.lng.toFixed(6)}
              </span>
            </p>
          )}

          <a
            href={mapsLink}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sky-700 font-bold hover:underline text-sm"
          >
            {pick(language, 'فتح الموقع على خرائط Google', 'Open location in Google Maps')}
          </a>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <iframe
              src={mapUrl}
              title="Live location map"
              className="w-full h-56"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/55 px-4 py-5 text-center">
          <p className="text-sm font-bold text-slate-700">
            {pick(language, 'بانتظار قراءة الموقع من الجهاز', 'Waiting for device location')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {pick(
              language,
              'فعّل GPS ومنح الإذن للمتصفح لإظهار الخريطة المباشرة.',
              'Enable GPS and allow browser permission to display the live map.'
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default LocationStatusCard;
