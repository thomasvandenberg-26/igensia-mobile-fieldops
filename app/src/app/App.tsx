import { useEffect, useRef } from 'react';
import { IonApp, IonRouterOutlet, IonSplitPane, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route, useLocation, useNavigate } from 'react-router-dom';

import { AuthProvider } from '../auth/context/AuthContext';
import { CurrentSessionProvider, useCurrentSession } from '../fieldops/context/CurrentSessionContext';
import { RequireAuth } from '../auth/guards/RequireAuth';
import { RequireGuest } from '../auth/guards/RequireGuest';
import { AppBootstrap } from './AppBootstrap';
import { ROUTE_PATTERNS, ROUTES } from './routes';
import { SideMenu } from '../shared/components/SideMenu';

import LoginEmailPage from '../auth/pages/LoginEmailPage';
import LoginCodePage from '../auth/pages/LoginCodePage';
import NewSessionMapPage from '../fieldops/pages/NewSessionMapPage';
import NewSessionDetailsPage from '../fieldops/pages/NewSessionDetailsPage';
import SessionPage from '../fieldops/pages/SessionPage';
import NewObservationPage from '../fieldops/pages/NewObservationPage';
import ObservationPage from '../fieldops/pages/ObservationPage';
import ProfilePage from '../auth/pages/ProfilePage';

/* CSS core Ionic + theme FieldOps (variables.scss genere precedemment) */
import '@ionic/react/css/core.css';
import '../theme/variables.scss';


// AndroidShareTarget :
import { Filesystem } from '@capacitor/filesystem';
import { AndroidShareTarget, AndroidShareTargetEventData } from '../capacitor/plugins/androidsharetarget';


setupIonicReact();


// top routing-enabled component, to be able to log all route changes
const RouterRootChild = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentSession } = useCurrentSession();
  // ref : le listener natif n'est enregistre qu'une fois, il doit lire la seance courante a jour
  const currentSessionIdRef = useRef<string | undefined>(undefined);
  currentSessionIdRef.current = currentSession?.id;
  
  useEffect(() => {
    console.log('Route changed to:', location.pathname);
  }, [location]);
  
  useEffect(() => {
    console.log('FieldOps App AndroidShareTarget init', AndroidShareTarget);
    // voir https://capacitorjs.com/docs/plugins/android
    AndroidShareTarget.addListener(
      'androidShareTargetEvent',
      async (data: AndroidShareTargetEventData) => {
        console.log('FieldOps App AndroidShareTargetEventData', JSON.stringify(data));
       
        // partage de texte seul (ex. WhatsApp) : pas d'uri, juste du texte -> Observation.notes
        const photos: { id: string; data: string; mime_type: string }[] = [];
        if (data.uri) {
          // the Filesystem API supports using full file:// paths, or reading content:// files on Android
          // see https://capacitorjs.com/docs/apis/filesystem#readfile
          const res = await Filesystem.readFile({ path: data.uri });
          if (res.data instanceof Blob) {
            console.log('FieldOps App AndroidShareTarget not impl\'d on PWA');
            return;
          }
          photos.push({ id: '0', data: res.data as unknown as string, mime_type: data.mimeType });
        }
        
        // navigate to new observation while passing photo + text as routing parameter :
        const observation = {
          notes: data.extraText || '',
          photos,
        };
        const sessionId = currentSessionIdRef.current;
        if (!sessionId) { console.log('AndroidShareTarget : pas de seance courante'); return; }
        navigate(ROUTES.observationNew(sessionId), { state: { observation } });
      }
    );
  }, [navigate]);
  
  return (
    <IonSplitPane contentId="main">
      <SideMenu />

      <IonRouterOutlet id="main">
        {/* Racine : ecran de demarrage / redirection (splash) */}
        <Route path="/" element={<AppBootstrap />} />

        {/*
          React Router v6 : plus de "component"/"exact" sur <Route>, on passe
          toujours par "element". Les guards (RequireAuth/RequireGuest) ne sont
          plus des <Route> a part entiere : ce sont des composants qui enveloppent
          l'ecran passe en element.
        */}
        <Route
          path={ROUTE_PATTERNS.loginEmail}
          element={<RequireGuest><LoginEmailPage /></RequireGuest>}
        />
        <Route
          path={ROUTE_PATTERNS.loginCode}
          element={<RequireGuest><LoginCodePage /></RequireGuest>}
        />

        {/*
          Meme composant SessionPage que /session/:id, mais sans id :
          affiche le flux global d'observations (v1, ou v2 sans seance
          en cours). L'onglet Carte/Liste est un state interne a
          SessionPage, plus une sous-route - chemin exact, pas de splat.
        */}
        <Route
          path={ROUTE_PATTERNS.observations}
          element={<RequireAuth><SessionPage /></RequireAuth>}
        />

        <Route
          path={ROUTE_PATTERNS.sessionNewMap}
          element={<RequireAuth><NewSessionMapPage /></RequireAuth>}
        />
        <Route
          path={ROUTE_PATTERNS.sessionNewDetails}
          element={<RequireAuth><NewSessionDetailsPage /></RequireAuth>}
        />

        <Route
          path={ROUTE_PATTERNS.observationNew}
          element={<RequireAuth><NewObservationPage /></RequireAuth>}
        />
        <Route
          path={ROUTE_PATTERNS.observation}
          element={<RequireAuth><ObservationPage /></RequireAuth>}
        />

        <Route
          path={ROUTE_PATTERNS.session}
          element={<RequireAuth><SessionPage /></RequireAuth>}
        />

        <Route
          path={ROUTE_PATTERNS.profile}
          element={<RequireAuth><ProfilePage /></RequireAuth>}
        />

        {/* Chemin inconnu : on repasse par la racine, qui redirige correctement */}
        {/* NON alors rien ne s'affiche après login
        <Route path="*" element={<Navigate to="/" replace />} />
        */}
      </IonRouterOutlet>
    </IonSplitPane>
  );
}


export default function App() {
  return (
    <IonApp>
      <AuthProvider>
        <CurrentSessionProvider>
          <IonReactRouter>
            <RouterRootChild/>
          </IonReactRouter>
        </CurrentSessionProvider>
      </AuthProvider>
    </IonApp>
  );
}
