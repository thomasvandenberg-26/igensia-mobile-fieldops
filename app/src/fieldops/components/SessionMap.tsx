import { useState, useEffect, useRef } from 'react';
import { GeoJSONPoint, Observation } from '../types';

import { geoJSONToLngLat } from '../utils';
import { GoogleMap } from '@capacitor/google-maps'; // et non de React !

interface Props {
  center: { lat: number; lng: number };
  observations: Observation[];
  onSelectObservation: (observation: Observation) => void;
}

// Premiere utilisation du plugin natif @capacitor/google-maps dans l'app
// Volontairement PAS factorise dans un hook ici pour le premier exercice
export function SessionMap({ center, observations, onSelectObservation }: Props) {
  const mapRef = useRef<HTMLElement>(null);
  const [map, setMap] = useState<GoogleMap | null>(null);

  // correspondance id observation -> id marker (BONUS EXTRA)
  const observationIdToMarkerIdMap = useRef(new Map<string, string>());
  // refs : le listener de clic est enregistre une seule fois, il doit lire
  // les dernieres valeurs et pas celles du premier rendu
  const observationsRef = useRef(observations);
  const onSelectRef = useRef(onSelectObservation);
  observationsRef.current = observations;
  onSelectRef.current = onSelectObservation;

  // Cree la carte UNE SEULE FOIS au montage
  useEffect(() => {
    let createdMap: GoogleMap | null = null;
    let cancelled = false;

    const createMap = async () => {
      if (!mapRef.current) return;

      const newMap = await GoogleMap.create({
        id: 'session-map',
        element: mapRef.current,
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        config: { center: { lat: center.lat, lng: center.lng }, zoom: 16 },
      });
      if (cancelled) {
        newMap.destroy();
        return;
      }
      createdMap = newMap;

      // BONUS : clic sur un marker -> retrouver l'observation (recherche
      // inverse dans la map observation -> marker) et la remonter
      await newMap.setOnMarkerClickListener((marker) => {
        let observationId: string | undefined;
        observationIdToMarkerIdMap.current.forEach((mId, oId) => {
          if (mId === marker.markerId) observationId = oId;
        });
        const observation = observationsRef.current.find(o => o.id === observationId);
        if (observation) onSelectRef.current(observation);
      });

      setMap(newMap);
    };
    createMap();

    return () => {
      // nettoyage sur démontage composant :
      cancelled = true;
      createdMap?.destroy();
      observationIdToMarkerIdMap.current.clear();
      setMap(null);
    };
  }, []); // NE PAS écouter center !

  // Recentre la camera sur la carte deja creee, sans jamais recreer l'instance
  useEffect(() => {
    if (!map) return;
    map.setCamera({
      coordinate: { lat: center.lat, lng: center.lng },
      animate: true,
    });
  }, [map, center.lat, center.lng]);

  // Resynchronise les marqueurs : retire ceux dont l'observation a disparu,
  // ajoute ceux des nouvelles observations
  useEffect(() => {
    const syncMarkers = async () => {
      if (!map) return;
      const idMap = observationIdToMarkerIdMap.current;

      // 1. suppression (removeMarkers attend des ids de MARKERS)
      const toRemove: string[] = [];
      idMap.forEach((mId, oId) => {
        if (!observations.find(o => o.id === oId)) toRemove.push(oId);
      });
      if (toRemove.length) {
        await map.removeMarkers(toRemove.map(oId => idMap.get(oId) as string));
        toRemove.forEach(oId => idMap.delete(oId));
      }

      // 2. ajout (sinon Error: markers array requires at least one marker)
      const toAdd = observations.filter(o => o.location && !idMap.has(o.id));
      if (toAdd.length) {
        const markerIds = await map.addMarkers(toAdd.map(o => ({
          coordinate: geoJSONToLngLat(o.location as GeoJSONPoint),
          title: o.category ?? 'Observation',
          snippet: o.notes ?? undefined,
        })));
        toAdd.forEach((o, i) => idMap.set(o.id, markerIds[i]));
      }
    };
    syncMarkers();
  }, [map, observations]);

  // style inline : le web component ne prend sa taille que si on la lui
  // donne explicitement (voir doc du plugin)
  return (
    <capacitor-google-map ref={mapRef} style={{
      display: 'inline-block',
      width: '100%', height: '100%'
    }}></capacitor-google-map>
  );
}
