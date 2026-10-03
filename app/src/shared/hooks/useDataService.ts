import { useMemo } from 'react';
import { useAuth } from '../../auth/context/AuthContext';
import { sessionsApi, SessionInput } from '../../fieldops/services/sessionsApi';
import { observationsApi, ObservationInput } from '../../fieldops/services/observationsApi';
import { profileApi } from '../../auth/services/profileApi';
import { GeoJSONPoint, Observation, PhotoInput } from '../../fieldops/types';

import { observationsRepository, updateLocalStoreForObservation, replaceLocalObservation } from '../../fieldops/services/observationsRepository';
import { outbox } from '../services/outbox';

// Accès unifié à la couche de services
// Injecte le token ET l'utilisateur courants dans toutes les fonctions d'API :
// les ecrans n'ont plus jamais a s'en soucier (separation of concerns) - y
// compris pour construire owner_id/user_id avant un create(), deplace ici
// plutot que duplique dans chaque ecran.
//
// A n'utiliser QUE depuis un ecran deja protege par RequireAuth : leve une
// erreur explicite si appele sans utilisateur connecte, meme logique que
// useAuth()/useCurrentSession(). C'est pour ca que CurrentSessionContext (qui,
// lui, doit continuer a fonctionner AVANT connexion) reste volontairement sur
// useAuth()/sessionsApi bruts plutot que ce hook.
export function useDataService() {
  const { token, user } = useAuth();

  return useMemo(() => {
    /*
    if (!token || !user) {
      throw new Error(
        'useDataService necessite un utilisateur connecte (a utiliser derriere RequireAuth)'
      );
    }
    */

    return {
      
      user,
      
      sessions: {
        fetchOne: (sessionId: string) => sessionsApi.fetchOne(token, sessionId),
        create: (input: SessionInput) =>
          sessionsApi.create(token, { ...input, owner_id: user.id }),
      },
      
      observations: {
        fetchBySession: (sessionId: string) => observationsRepository.fetchBySession(token, sessionId),
        // TODO remplacer les appels de observationsApi par des appels d'un
        // nouvel observationsRepository qui a exactement les mêmes fonctions
        // qui elles appellent observationsApi (design pattern "proxy") :
        fetchNearby: (position: GeoJSONPoint, limit?: number) =>
          observationsRepository.fetchNearby(token, position, limit),
        fetchOne: (sessionId: string, obsId: string) =>
          observationsRepository.fetchOne(token, sessionId, obsId),
        create: (sessionId: string, input: ObservationInput) =>
          observationsRepository.create(token, sessionId, { ...input, user_id: user.id }),
        update: (sessionId: string, obsId: string, input: ObservationInput) =>
          observationsRepository.update(token, sessionId, obsId, input),
        delete: (sessionId: string, obsId: string) =>
          observationsApi.delete(token, sessionId, obsId),
        addPhoto: (obsId: string, input: PhotoInput) =>
          observationsApi.addPhoto(token, obsId, input),
      },
      
      observationsApi: {
        fetchBySession: (sessionId: string) => observationsApi.fetchBySession(token, sessionId),
        fetchNearby: (position: GeoJSONPoint, limit?: number) =>
          observationsApi.fetchNearby(token, position, limit),
        fetchOne: (sessionId: string, obsId: string) =>
          observationsApi.fetchOne(token, sessionId, obsId),
        create: (sessionId: string, input: ObservationInput) =>
          observationsApi.create(token, sessionId, { ...input, user_id: user.id }),
        update: (sessionId: string, obsId: string, input: ObservationInput) =>
          observationsApi.update(token, sessionId, obsId, input),
        delete: (sessionId: string, obsId: string) =>
          observationsApi.delete(token, sessionId, obsId),
        addPhoto: (obsId: string, input: PhotoInput) =>
          observationsApi.addPhoto(token, obsId, input),
      },
      
      // TODO rajouter une méthode syncAll() qui appelle les syncAll des repositories
      syncAll: async () => {
        console.log('useDataService syncAll()');
        // implémentez dataService.syncAll() : pour chaque opération de l'outbox, la réaliser avec le repository approprié. Tester sur le téléphone (ex. passer en mode avion).
        // PAS DE MERGE par id pour l'instant, TOUTES les opérations sont exécutées dans l'ordre
        const failedIds: string[] = [];
        const ops = await outbox.list();
        for (let i = 0; i < ops.length; i++) {
          const op = ops[i];
          if (op.entity === 'observation') {
            const obs: Observation = op.payload as Observation; 
            if (failedIds.find(id => id === obs.id)) {
              continue; // on n'exécute si une précédente opération sur le même id a échouée

            } else if (op.operationType === 'create') {
              try {
                // l'id genere cote client est envoye au serveur (s'il l'accepte)
                const resObservation = await observationsApi.create(token, obs.session_id, obs as any);
                await outbox.remove(op.id);
                await replaceLocalObservation(obs.id, resObservation);
              } catch (e) {
                const err = (e instanceof Error) ? e as Error : null;
                const isNetworkError = err?.name === 'TimeoutError' || err instanceof TypeError;
                console.log('DataService syncAll create error', JSON.stringify(op, null, 2), e);
                failedIds.push(obs.id); // les operations suivantes sur le meme id attendent
                if (isNetworkError) {
                  await outbox.markFailed(op.id, JSON.stringify(e, null, 2));
                } else {
                  await outbox.markFailed(op.id, err?.message || JSON.stringify(e)); // erreur metier, a resoudre
                }
              }
              
            } else if (op.operationType === 'update') {
              try {
                const resObservation = await observationsApi.update(token, obs.session_id, obs.id, obs);
                await outbox.remove(op.id);
                await updateLocalStoreForObservation(resObservation);
              } catch (e) {
                const err = (e instanceof Error) ? e as Error : null;
                const isNetworkError = err?.name === 'TimeoutError';
                console.log('DataService syncAll error', JSON.stringify(op, null, 2), e);
                if (isNetworkError) {
                  outbox.markFailed(op.id, JSON.stringify(e, null, 2));
                  
                } else {
                  // erreur métier pas résolvable immédiatement, on change l'opération dans l'outbox ;
                  obs.sync_status = 'ERROR';
                  const payload = { ...obs };
                  delete obs.user;
                  delete obs.photos;
                  await outbox.enqueue({
                    entity: 'observation',
                    entityId: obs.id, // id (définitif, généré côté client) de l'entité concernée
                    sessionId: obs.session_id, // pour une observation, sa séance parente
                    operationType: 'update',
                    payload, // données à envoyer (objet métier ou son diff)
                  });
                  await outbox.remove(op.id);
                }
              }
            }
          }
        }
      },
      
      profile: {
        deleteData: () => profileApi.deleteData(token),
        updatePreferences: (patch: Record<string, unknown>) =>
          profileApi.updatePreferences(token, patch),
      },
      
    };
  }, [token, user]);
}
