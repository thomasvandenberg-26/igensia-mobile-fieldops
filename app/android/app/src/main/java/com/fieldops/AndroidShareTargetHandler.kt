package com.fieldops

import android.content.Intent
import android.content.Intent.ACTION_SEND
import android.net.Uri
import android.util.Log
import androidx.core.content.IntentCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.annotation.CapacitorPlugin


/**
 * Default TAG to use in logging
 * ex. Log.d(TAG, "log message")
 */
val Any.TAG: String
    get() = if (this::class.java.simpleName.length > 23) this::class.java.simpleName.substring(0, 24)
    else this::class.java.simpleName // limited to 23 chars



@CapacitorPlugin(name = "AndroidShareTarget")
class AndroidShareTargetHandler : Plugin() {

    override fun handleOnNewIntent(intent: Intent?) {
        Log.d(TAG, "handleOnNewIntent")
        when(intent ?.action){
            ACTION_SEND -> {
                if (intent.type?.startsWith("image/") == true){
                    handleSendImage(intent) // Handle single image being sent
                } else if (intent.type?.startsWith("text/") == true) {
                    handleSendText(intent) // texte seul partage (ex. depuis WhatsApp)
                }
            } else -> {
              // TODO
          }
        }
    }

    fun handleSendImage(intent: Intent) {
        (IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java) as? Uri).let { uri ->
            val extraText = intent.getCharSequenceExtra(Intent.EXTRA_TEXT) // que faire de la partie texte ?

            val cr = context.contentResolver
            val mimeType = if (uri != null) cr.getType(uri) else null;

            val ret = JSObject()
            ret.put("uri", uri)
            ret.put("mimeType", mimeType)
            // TODO Rajouter le partage aussi de texte depuis WhatsApp ou autre application de messagerie, et le mettre dans Observation.notes
            if (extraText != null) ret.put("extraText", extraText.toString())

            Log.d(TAG, "notifyListeners $uri $mimeType $extraText !")
            notifyListeners("androidShareTargetEvent", ret)
        }
    }

    fun handleSendText(intent: Intent) {
        val extraText = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
        val ret = JSObject()
        ret.put("mimeType", intent.type)
        if (extraText != null) ret.put("extraText", extraText)
        Log.d(TAG, "notifyListeners text $extraText !")
        notifyListeners("androidShareTargetEvent", ret)
    }
}
