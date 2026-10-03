import { Observation, ObservationInput, Photo, PhotoInput, GeoJSONPoint } from '../types';
import { observationsApi } from './observationsApi';

import { preferencesLocalStore } from '../../shared/services/localStore';
import { outbox } from '../../shared/services/outbox';


const OBSERVATIONS_KEY = 'observations';

// erreur reseau (hors ligne / timeout) : on bascule en mode offline
const isNetworkError = (e: unknown) => {
  const err = (e instanceof Error) ? e as Error : null;
  return err?.name === 'TimeoutError' || err instanceof TypeError; // fetch hors ligne => TypeError "Failed to fetch"
};

const getLocalObservations = async () => {
  return (await preferencesLocalStore.get(OBSERVATIONS_KEY) || []) as Observation[];
}

// TODO lorsqu'elles réussissent, rafraichir (ou mettre à jour partiellement) un cache local des objets à l'aide de (app/)src/shared/services/localStore.tsx
export const updateLocalStoreForObservation = async (observation: Observation) => {
  const localObservations = await getLocalObservations();
  const ind = localObservations.map((o, ind) => o.id === observation.id ? ind : null).filter(ind => !!ind)[0];
  if (ind) {
    // refresh que quand pas modifiée :
    if (localObservations[ind].sync_status === 'SYNCED') localObservations[ind] = observation;
  } else {
    localObservations.push(observation);
  }
  await preferencesLocalStore.set(OBSERVATIONS_KEY, localObservations);
}

// remplace dans le cache local l'observation creee hors ligne (id client) par celle renvoyee par le serveur
export const replaceLocalObservation = async (oldId: string, observation: Observation) => {
  const localObservations = (await getLocalObservations()).filter(o => o.id !== oldId && o.id !== observation.id);
  localObservations.push(observation);
  await preferencesLocalStore.set(OBSERVATIONS_KEY, localObservations);
}

export const observationsRepository = {
  
  async fetchBySession(token: string, sessionId: string): Promise<Observation[]> {
    // TODO TD implémenter au-dessus d'observationsApi
    return await observationsApi.fetchBySession(token, sessionId);
    // TODO lorsqu'elles réussissent, rafraichir (ou mettre à jour partiellement) un cache local des objets à l'aide de (app/)src/shared/services/localStore.tsx
  },

  async fetchNearby(
    token: string,
    position: GeoJSONPoint,
    limit = 20,
    radiusMeters = 1000000
  ): Promise<Observation[]> {
    // TODO TD implémenter au-dessus d'observationsApi
    //return await observationsApi.fetchNearby(token, position, limit, radiusMeters); // TD
    try {
      const observations = await observationsApi.fetchNearby(token, position, limit, radiusMeters)
      
      // TODO lorsqu'elles réussissent, rafraichir (ou mettre à jour partiellement) un cache local des objets à l'aide de (app/)src/shared/services/localStore.tsx
      const localObservations = await getLocalObservations();
      const localChangedObservations = localObservations.filter(lo => lo.sync_status !== 'SYNCED');
      // refresh que quand pas modifiée :
      const observationsWithoutLocalChanges = observations.filter(o => !localChangedObservations.find(lo => lo.id == o.id));
      await preferencesLocalStore.set(OBSERVATIONS_KEY, [...localChangedObservations, ...observationsWithoutLocalChanges]);
      return observations;
      
    } catch (e) {
      console.log('observationsRepository fetchNearby network error, returning cache', e);
      return await getLocalObservations();
    }
  },

  async fetchOne(token: string, sessionId: string, observationId: string): Promise<Observation> {
    // TODO TD implémenter au-dessus d'observationsApi
    //return await observationsApi.fetchOne(token, sessionId, observationId); // TD
    // TODO lorsqu'elles réussissent, rafraichir (ou mettre à jour partiellement) un cache local des objets à l'aide de (app/)src/shared/services/localStore.tsx
    try {
      const observation = await observationsApi.fetchOne(token, sessionId, observationId);
      
      // TODO lorsqu'elles réussissent, rafraichir (ou mettre à jour partiellement) un cache local des objets à l'aide de (app/)src/shared/services/localStore.tsx
      await updateLocalStoreForObservation(observation);
      return observation;
      
    } catch (e) {
      console.log('observationsRepository fetchOne network error, returning cache', e);
      const localObservations = await getLocalObservations();
      const localObservation = localObservations.find(o => o.id === observationId);
      if (localObservation) {
        return localObservation;
      }
      throw 'Observation non trouvée dans le stockage local : ' + observationId;
    }
  },

  async create(
    token: string,
    sessionId: string,
    input: ObservationInput & { user_id: string }
  ): Promise<Observation> {
    try {
      const observation = await observationsApi.create(token, sessionId, input);
      await updateLocalStoreForObservation(observation);
      return observation;

    } catch (e) {
      if (!isNetworkError(e)) throw e; // erreurs metier : a corriger par l'utilisateur

      console.log('observationsRepository create network error, adding to cache and outbox', e);
      const nowISO601 = new Date().toISOString();
      const createdObservation: Observation = {
        id: crypto.randomUUID(), // identifiant genere cote client !
        session_id: sessionId,
        created_at: nowISO601,
        updated_at: nowISO601,
        status: 'created',
        status_changed_at: nowISO601,
        sync_status: 'PENDING', // TRES IMPORTANT pour l'offline !
        ...input,
      };
      const localObservations = await getLocalObservations();
      localObservations.push(createdObservation);

      const payload = { ...createdObservation };
      delete payload.user;
      delete payload.photos; // TODO photos hors ligne (ajout separe via addPhoto)
      await outbox.enqueue({
        entity: 'observation',
        entityId: createdObservation.id,
        sessionId,
        operationType: 'create',
        payload,
      });
      await preferencesLocalStore.set(OBSERVATIONS_KEY, localObservations);
      return createdObservation;
    }
  },

  async update(
    token: string,
    sessionId: string,
    observationId: string,
    input: ObservationInput
  ): Promise<Observation> {
    // TODO TD implémenter au-dessus d'observationsApi
    //return await observationsApi.fetchOne(token, sessionId, observationId); // TD
    // TODO lorsqu'elles réussissent, rafraichir (ou mettre à jour partiellement) un cache local des objets à l'aide de (app/)src/shared/services/localStore.tsx
    const localObservations = await getLocalObservations();
    try {
      const observation = await observationsApi.update(token, sessionId, observationId, input);
      
      // TODO lorsqu'elles réussissent, rafraichir (ou mettre à jour partiellement) un cache local des objets à l'aide de (app/)src/shared/services/localStore.tsx
      await updateLocalStoreForObservation(observation);
      return observation;
      
    } catch (e) {
      const err = (e instanceof Error) ? e as Error : null;
      const isNetworkError = err?.name === 'TimeoutError';
      if (isNetworkError) {
        console.log('observationsRepository update network error, updating cache and adding outbox operation', e);
  
        // TODO lors de toute écriture, rajoutez d'abord l'opération correspondante dans ladite file d'outbox (hint : sync_status PENDING).
        let updatedObservation: Observation;
        const singleIndList = localObservations.map((o, ind) => o.id === observationId ? ind : null).filter(ind => ind !== null);
        const hasLocalObservation = singleIndList?.length;
        if (hasLocalObservation) {
          const ind = singleIndList[0];
          updatedObservation = {
            ...(localObservations[ind as number]),
            ...input,
            sync_status: 'PENDING', // TRES IMPORTANT pour l'offline !
          };
          localObservations[ind as number] = updatedObservation;
        } else {
          const nowISO601 = new Date().toISOString();
          updatedObservation = {
            id: observationId, // crypto.randomUUID(), // si création identifiant généré côté client !
            session_id: sessionId,
            user_id: 'dummy',
            created_at: nowISO601, 
            updated_at: nowISO601,
            status: 'created',
            status_changed_at: nowISO601,
            sync_status: 'PENDING', // TRES IMPORTANT pour l'offline !
            ...input
          };
          localObservations.push(updatedObservation);
        }
        const payload = { ...updatedObservation };
        delete payload.user;
        delete payload.photos;
        await outbox.enqueue({
          entity: 'observation',
          entityId: updatedObservation.id, // id (définitif, généré côté client) de l'entité concernée
          sessionId: updatedObservation.session_id, // pour une observation, sa séance parente
          operationType: 'update',
          payload, // données à envoyer (objet métier ou son diff)
        });
        
        await preferencesLocalStore.set(OBSERVATIONS_KEY, localObservations);
        return updatedObservation;
        
      }
      console.log('observationsRepository update unknown error, rethrowing', e);
      // erreurs métier, à résoudre par l'utilisateur :
      // ex. GraphQLRequestError    
      /* {
          "errors": [
              {
                  "message": "numeric field overflow", // poids_g trop grand
                  "extensions": {
                      "path": "$",
                      "code": "data-exception"
                  }
              }
          ]
      }
      */
      throw e;
    }
  },

  async delete(
    token: string,
    sessionId: string,
    observationId: string,
  ): Promise<Observation> {
    return await observationsApi.delete(token, sessionId, observationId);
  },

  async addPhoto(
    token: string,
    observationId: string,
    input: PhotoInput
  ): Promise<Photo> {
    return await observationsApi.addPhoto(token, observationId, input);
  }
};
