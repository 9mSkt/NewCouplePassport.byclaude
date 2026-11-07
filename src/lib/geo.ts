export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60000,
    });
  });
}

export interface Place {
  countryCode: string;
  city: string | null;
}

/** BigDataCloud free client-side reverse geocoding (no API key). Spec §6.4 option A. */
export async function reverseGeocode(lat: number, lng: number): Promise<Place> {
  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('localityLanguage', 'en');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  const j = (await res.json()) as { countryCode?: string; city?: string; locality?: string; principalSubdivision?: string };
  if (!j.countryCode) throw new Error('no country');
  return {
    countryCode: j.countryCode.toUpperCase(),
    city: j.city || j.locality || j.principalSubdivision || null,
  };
}
