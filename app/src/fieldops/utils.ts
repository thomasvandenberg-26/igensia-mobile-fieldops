///import { LatLng } from '@capacitor/google-maps'; // et non de React !
import { GeoJSONPoint, LngLat } from './types'; // et non de React !

import { Camera, CameraDirection } from '@capacitor/camera';
import { Photo, PhotoInput } from './types';


export const defaulLng = 4.85;
export const defaulLat = 45.77;
export const defaulLocation: GeoJSONPoint = {
  type: "Point",
  coordinates: [defaulLng, defaulLat]
};

export const geoJSONToLngLat/*: LatLng*/ = (geoJsonPoint: GeoJSONPoint) => {
  return {
    lng: geoJsonPoint.coordinates[0],
    lat: geoJsonPoint.coordinates[1],
  }
}
export const lngLatToGeoJSON = (lngLat: LngLat): GeoJSONPoint => {
  return {
    type: "Point",
    coordinates: [lngLat.lng, lngLat.lat]
  };
}


export const BYTEA_HEX_PREFIX = '\\x';

export const photoToBase64ImgSrc = (p: Photo) => {
  const base64Content = p.data.startsWith(BYTEA_HEX_PREFIX) ?
    hexDecode(p.data.substring(BYTEA_HEX_PREFIX.length)) : p.data;
  return 'data:' + p.mime_type + ';base64, ' + base64Content;
}

// pour écrire les photos stockées de bytea
// https://stackoverflow.com/questions/21647928/javascript-unicode-string-to-hex
export const hexEncode = function(s: string) {
    let hex;
    let result = "";
    for (let i=0; i<s.length; i++) {
        hex = s.charCodeAt(i).toString(16);
        result += ("000"+hex).slice(-4);
    }
    return result
}
  // pour lire les photos stockées en bytea
export const hexDecode = function(s: string) {
    const hexes = s.match(/.{1,4}/g) || [];
    let back = "";
    for(let j = 0; j<hexes.length; j++) {
        back += String.fromCharCode(parseInt(hexes[j], 16));
    }

    return back;
}


// LATER afficher erreur
export const takePhoto = async (): Promise<PhotoInput | undefined> => {
  //if (!PHOTO_ENABLED) return; // LATER ?
  // TODO en testant la photo, trouver (au moins) un bug d'usage, et le corriger dans app/src/fieldops/utils.ts !
  try {
    // NB. en PWA choisit plutôt un fichier, voici un exemple petit :
    // https://commons.wikimedia.org/wiki/File:JPEG_example_JPG_RIP_001.jpg
    const result = await Camera.takePhoto({
      quality: 70, // 0-100, compromis qualité/poids (10 donnait une image illisible)
      targetHeight: 600, // image raisonnable, pas 10px (illisible)
      targetWidth: 800, // image raisonnable, pas 10px (illisible)
      cameraDirection: CameraDirection.Rear, // objectif arrière (et non selfie) pour photographier une observation
      includeMetadata: true, // pour avoir result.metadata.format permettant de bâtir un mimeType
      //encodingType: EncodingType.JPEG, // [défaut, OK pour FieldOps]
    });
    if (result.thumbnail) {
      // BEWARE convert for postgres bytea format :
      const data = BYTEA_HEX_PREFIX + hexEncode(result.thumbnail);
      return {
        data,
        mime_type: 'image/' + (result.metadata?.format || 'jpeg'),
      };
    }
    
  } catch (e) {
    const error = e as any;
    // error.code contains the structured error code (e.g. 'OS-PLUG-CAMR-0003')
    // when thrown by the native layer. See the Errors section for all codes.
    const message = error.code ? `[${error.code}] ${error.message}` : error.message;
    console.error('takePhoto failed:', message);
  }
}
