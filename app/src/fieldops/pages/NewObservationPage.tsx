import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { FieldsScreenLayout } from '../../shared/layout/FieldsScreenLayout';
import { ObservationForm, ObservationFormValues } from '../components/ObservationForm';
import { useCurrentPosition } from '../../shared/hooks/useCurrentPosition';
import { useDataService } from '../../shared/hooks/useDataService';
import { ROUTES } from '../../app/routes';

import { takePhoto } from '../utils';
import { Photo } from '../types';


// "Nouvelle observation" : la position est initialisee a la position GPS actuelle,
// exactement comme l'ecran "Nouvelle seance". "nombre" demarre a 1 (valeur par
// defaut de la colonne sighting.nombre en base).
export default function NewObservationPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const dataService = useDataService();
  const { getCurrentPosition } = useCurrentPosition();
  const location = useLocation();
  const navigate = useNavigate();
  const [initialValues, setInitialValues] = useState<ObservationFormValues | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    getCurrentPosition().then(async (pos) => {
      const initVal = {
        id: undefined,
        category: null,
        latitude: pos.latitude,
        longitude: pos.longitude,
        nombre: 1,
        poids_g: null,
        notes: '',
        ...(location.state?.observation || { photos: [] }), // TODO for take photo or AndroidShareTarget
        sync_status: 'PENDING',
      };
      if (!initVal.photos?.length && !location.state?.observation) {
        // TODO photo for AndroidShareTarget
        const p = await takePhoto();
        if (p) {
          initVal.photos.push(p);
        } // (sinon annulé)
      }
      initVal.photos.forEach((p: Photo, ind: number) => { if (!p.id) p.id = ind + '' });
      setInitialValues(initVal)
    });
  }, [location.state?.observation, getCurrentPosition]);

  if (!initialValues || !sessionId) return null; // LATER etat de chargement (spinner)

  return (
    <FieldsScreenLayout title="Nouvelle observation" defaultHref={ROUTES.session(sessionId)}>
      <ObservationForm
        mode="create"
        initialValues={initialValues}
        errorMessage={errorMessage}
        onSubmit={async (values) => {
          if (!values.category) return;
          try {
            await dataService.observations.create(sessionId, {
              category: values.category,
              // GeoJSON : coordinates = [longitude, latitude], dans cet ordre.
              location: { type: 'Point', coordinates: [values.longitude, values.latitude] },
              nombre: values.nombre,
              poids_g: values.poids_g,
              notes: values.notes,
              photos: values.photos,
            });
            // Retour a l'ecran d'avant (SessionMap/Liste) plutot que sur le detail
            // de l'observation tout juste creee - c'est de la qu'on est arrive.
            console.log('NewObservationPage - navigate back');
            navigate(-1);
          } catch (e) {
            const err = (e instanceof Error) ? e as Error : null;
            setErrorMessage(err?.message || JSON.stringify(e, null, 2));
          }
        }}
      />
    </FieldsScreenLayout>
  );
}
