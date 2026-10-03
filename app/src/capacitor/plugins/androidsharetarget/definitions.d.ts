
import { Plugin } from '@capacitor/core'

// voir https://capacitorjs.com/docs/plugins/tutorial/designing-the-plugin-api

export interface AndroidShareTargetEventData {
  mimeType: string;
  uri?: string; // absent si seul du texte est partage
  extraText?: string;
}

// must be the same as in kotlin code notifyListeners('androidShareTargetEvent', ...)
export type AndroidShareTargetEventType = 'androidShareTargetEvent';

export interface AndroidShareTargetPlugin extends Plugin {
  // override the capacitor plugin addListener method :
  // see https://github.com/ionic-team/capacitor/issues/6234
  addListener: (eventName: AndroidShareTargetEventType, handler: (data: AndroidShareTargetEventData) => void) => void;
}
