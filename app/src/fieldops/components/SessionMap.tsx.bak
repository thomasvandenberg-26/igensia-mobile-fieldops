import { useState, useEffect, useRef } from 'react';
import { GeoJSONPoint, Observation } from '../types';

import { geoJSONToLngLat } from '../utils';
import { GoogleMap } from '@capacitor/google-maps'; // et non de React !
///import { LatLng } from '@capacitor/google-maps/typings/definitions.d';


interface Props {
  center: { lat: number; lng: number };
  observations: Observation[];
  onSelectObservation: (observation: Observation) => void;
}

// Premiere utilisation du plugin natif @capacitor/google-maps dans l'app
// Volontairement PAS factorise dans un hook ici pour le premier exercice
// NB. ce sera un exercice separe de reprendre ce code en hook partage
// pour les 2 autres cas LocationPickerModal/NewSessionMapPage
export function SessionMap({ center, observations, onSelectObservation }: Props) {
  const mapRef = useRef<HTMLElement>(null);
  const [map, setMap] = useState<GoogleMap | null>(null);

  // Cree la carte UNE SEULE FOIS au montage (contrairement a une carte web ou
  // on peut se permettre de re-render un composant declaratif a chaque
  // changement de props, ici GoogleMap.create() est couteux : on cree une
  // seule instance puis on la met a jour via son API
  useEffect(() => {
    const createMap = async () => {
      if (!mapRef.current) return;

      // TODO code d'initialisation de Google Maps :
      const newMap = await GoogleMap.create({
        id: 'session-map',
        element: mapRef.current,
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        //config: { center: { lat: 45.7, lng: 4.8 }, zoom: 16 }
        config: { center: { lat: center.lat, lng: center.lng }, zoom: 16 }
      });
      // HACK on rajoute la correspondance id métier - marker directement sur
      // l'objet technique, sans quoi même un useRef() ne parvient pas à en
      // suivre le cycle de vie :
      newMap.observationIdToMarkerIdMap = new Map<string, string>();
      setMap(newMap);
     
      // TODO rajouter un marqueur sur la même position pour tester, puis le commenter :
      /*
      const markerId = await newMap.addMarker({
        coordinate: {
          lat: 45.7,
          lng: 4.8
        }
      });
      */
      
      // TODO TP BONUS écouter les événements de click sur les markers,
      // et en afficher les informations dans un alert()
      // TODO TP BONUS EXTRA afficher l'observation correspondante à l'aide de onSelectObservation et newMap.observationIdToMarkerIdMap
    }
    createMap();

    return () => {
      // nettoyage sur démontage composant :
      map?.destroy();
      setMap(null);
    };
  }, [mapRef.current, setMap]); // NE PAS écouter center !

  // Recentre la camera sur la carte deja creee, sans jamais recree
  // l'instance
  useEffect(() => {
    // TODO TP code de mise à jour du centre de la carte lorsque la propriété center change :
  }, [/* TODO TP*/]);

  // Resynchronise les marqueurs quand la liste d'observations change : on
  // retire tous les anciens puis on ajoute les nouveaux. Pas de diff fin
  // (garder seulement les marqueurs modifies) pour l'instant
  useEffect(() => {
    const addMarkers = async () => {
      if (!map || !observations?.length) return;
      // sinon Error: Invalid Arguments Provided: markers array requires at least one marker.
      console.log('addMarkers');
      
      /* VERSION SIMPLE (sans le BONUS) :
      // TODO code d'ajoût des markers des observations (disponibles en propriété du composant React) :
      // (hint : s'aider de geoJSONToLngLat)
      await map.addMarkers(observations.map(o => {
        return {
          // TODO rajouter au moins un champ optionnel de configuration du Marker, voir https://capacitorjs.com/docs/apis/google-maps#marker
          coordinate: geoJSONToLngLat(o.location as GeoJSONPoint),
        };
      }));
      */
              
      /* VERSION COMPLETE : */
      // TODO BONUS (voir plus bas)
      const oIdToBeRemoved: string[] = [];
      const observationIdToMarkerIdMap = map.observationIdToMarkerIdMap as Map<string, string>;
      observationIdToMarkerIdMap?.forEach((mId, oId) => {
        if (!observations.find(o => o.id === oId)) {
          oIdToBeRemoved.push(oId);
        }
      });
      if (oIdToBeRemoved?.length) {
        await map.removeMarkers(oIdToBeRemoved);
      }

      // TODO code d'ajoût des markers des observations (disponibles en propriété du composant React) :
      // (hint : s'aider de geoJSONToLngLat)
      const toBeAddedObservations = observations.filter(o => !observationIdToMarkerIdMap.get(o.id));
      let mIds: string[] = [];
      if (toBeAddedObservations?.length) {
        mIds = await map.addMarkers(toBeAddedObservations.map(o => {
          return {
            // TODO rajouter au moins un champ optionnel de configuration du Marker, voir https://capacitorjs.com/docs/apis/google-maps#marker
            coordinate: geoJSONToLngLat(o.location as GeoJSONPoint),
          };
        }));
        console.log('markers rajoutés');
      }
      
      // TODO BONUS EXTRA se rappeler des ids des markers rajoutés
      // puis s'en servir pour supprimer tous les markers avant d'en rajouter
      // (hint : s'aider de map.observationIdToMarkerIdMap)
      if (oIdToBeRemoved?.length || toBeAddedObservations?.length) {
        oIdToBeRemoved.forEach(oId => observationIdToMarkerIdMap.delete(oId));
        toBeAddedObservations.forEach((o, mIdInd) => {
          observationIdToMarkerIdMap.set(o.id, mIds[mIdInd]);
        });
        map.observationIdToMarkerIdMap = observationIdToMarkerIdMap;
      }
      /**/
    }
    addMarkers();
  }, [/* TODO */map, observations]);

  // style inline plutot qu'une classe externe, car
  // Le web component ne prend sa taille que si on la lui donne explicitement
  // (voir doc du plugin)
  return (<>
    {/*  TODO code d'affichage du composant JSX Google Maps de capacitor */}
    <capacitor-google-map ref={mapRef} style={{
      display: 'inline-block',
      width: '100%', height: '100%'
    }}></capacitor-google-map>
  </>);
}
