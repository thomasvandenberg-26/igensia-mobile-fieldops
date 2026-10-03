import { useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';

// Necessite @capacitor/geolocation (npm i @capacitor/geolocation) et la permission
// de localisation declaree sur iOS/Android.
const FALLBACK_POSITION = { longitude: 4.8095159, latitude: 45.7648829 };

export function useCurrentPosition() {
  const getCurrentPosition = useCallback(async () => {
    try {
      // demande la permission si besoin (Android/iOS), sinon le navigateur la demande lui-meme
      try {
        await Geolocation.requestPermissions();
      } catch {
        // sur le web (PWA) requestPermissions n'est pas supporte : on ignore
      }
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      // conversion vers le format attendu par les appelants
      return {
        longitude: position.coords.longitude,
        latitude: position.coords.latitude,
      };
    } catch (e) {
      console.error('getCurrentPosition failed, position par defaut utilisee :', e);
      return FALLBACK_POSITION;
    }
  }, []);

  return { getCurrentPosition };
}
