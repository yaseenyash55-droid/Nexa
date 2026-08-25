package com.nexa.social.utils

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.PowerManager
import android.util.Log

/**
 * Nexa Proximity Sensor & Modern VoIP Audio Router (API 31+ Standard)
 *
 * Manages device proximity detection and modern dynamic audio routing:
 * - On Android 12+ (API 31+): Uses AudioManager.setCommunicationDevice() for zero-dropout earpiece/speaker switching.
 * - On Android < 12: Uses graceful fallback with MODE_IN_COMMUNICATION.
 * - Acquires PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK when held to the ear.
 */
class ProximitySensorManager(
    context: Context,
    private val onProximityChanged: ((isNear: Boolean) -> Unit)? = null
) : SensorEventListener {

    companion object {
        private const val TAG = "ProximitySensorManager"
        private const val PROXIMITY_THRESHOLD_CM = 5.0f
        private const val WAKE_LOCK_TAG = "Nexa:ProximityScreenOff"
    }

    private val appContext = context.applicationContext
    private val sensorManager = appContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val powerManager = appContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    private val proximitySensor: Sensor? = sensorManager?.getDefaultSensor(Sensor.TYPE_PROXIMITY)

    private var proximityWakeLock: PowerManager.WakeLock? = null
    private var isListening = false
    private var isNear = false
    private var isEnabled = false
    private var audioFocusRequest: AudioFocusRequest? = null

    init {
        initWakeLock()
    }

    private fun initWakeLock() {
        if (powerManager == null) return
        try {
            if (powerManager.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) {
                proximityWakeLock = powerManager.newWakeLock(
                    PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK,
                    WAKE_LOCK_TAG
                ).apply {
                    setReferenceCounted(false)
                }
            } else {
                Log.w(TAG, "PROXIMITY_SCREEN_OFF_WAKE_LOCK is not supported on this hardware.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize proximity wake lock", e)
        }
    }

    /**
     * Activates proximity tracking and requests communication audio focus.
     */
    fun start(allowScreenOff: Boolean = true) {
        this.isEnabled = allowScreenOff
        requestVoipAudioFocus()

        if (proximitySensor == null || isListening) return

        sensorManager?.registerListener(
            this,
            proximitySensor,
            SensorManager.SENSOR_DELAY_NORMAL
        )
        isListening = true
    }

    /**
     * Updates whether proximity screen-off and earpiece routing should be permitted.
     */
    fun updateState(allowScreenOff: Boolean) {
        this.isEnabled = allowScreenOff
        if (!allowScreenOff) {
            releaseWakeLock()
            routeAudioToSpeaker()
        } else if (isNear) {
            acquireWakeLock()
            routeAudioToEarpiece()
        } else {
            routeAudioToSpeaker()
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        event ?: return
        if (event.sensor.type != Sensor.TYPE_PROXIMITY) return

        val distance = event.values.firstOrNull() ?: return
        val maxRange = proximitySensor?.maximumRange ?: PROXIMITY_THRESHOLD_CM

        // Near condition: distance is less than threshold or strictly less than max range
        isNear = distance < PROXIMITY_THRESHOLD_CM && distance < maxRange

        if (isNear && isEnabled) {
            acquireWakeLock()
            routeAudioToEarpiece()
        } else {
            releaseWakeLock()
            if (!isEnabled) {
                routeAudioToSpeaker()
            }
        }

        onProximityChanged?.invoke(isNear)
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun acquireWakeLock() {
        try {
            proximityWakeLock?.let { lock ->
                if (!lock.isHeld) {
                    lock.acquire(60 * 60 * 1000L)
                    Log.d(TAG, "Proximity wake lock acquired (Screen off near ear)")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error acquiring proximity wake lock", e)
        }
    }

    private fun releaseWakeLock() {
        try {
            proximityWakeLock?.let { lock ->
                if (lock.isHeld) {
                    lock.release(PowerManager.RELEASE_FLAG_WAIT_FOR_NO_PROXIMITY)
                    Log.d(TAG, "Proximity wake lock released (Screen restored)")
                }
            }
        } catch (e: Exception) {
            try {
                if (proximityWakeLock?.isHeld == true) {
                    proximityWakeLock?.release()
                }
            } catch (_: Exception) {}
        }
    }

    /**
     * Requests audio focus for VoIP communication mode.
     */
    private fun requestVoipAudioFocus() {
        audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()

            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(attributes)
                .setAcceptsDelayedFocusGain(false)
                .build()

            audioFocusRequest = request
            audioManager?.requestAudioFocus(request)
        } else {
            @Suppress("DEPRECATION")
            audioManager?.requestAudioFocus(
                null,
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
            )
        }
    }

    /**
     * Modern API 31+ earpiece routing with legacy fallback.
     */
    private fun routeAudioToEarpiece() {
        val am = audioManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val devices = am.availableCommunicationDevices
            val earpiece = devices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE }
            if (earpiece != null) {
                am.setCommunicationDevice(earpiece)
            }
        } else {
            @Suppress("DEPRECATION")
            am.isSpeakerphoneOn = false
        }
    }

    /**
     * Modern API 31+ speakerphone routing with legacy fallback.
     */
    private fun routeAudioToSpeaker() {
        val am = audioManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val devices = am.availableCommunicationDevices
            val speaker = devices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
            if (speaker != null) {
                am.setCommunicationDevice(speaker)
            }
        } else {
            @Suppress("DEPRECATION")
            am.isSpeakerphoneOn = true
        }
    }

    /**
     * Stops sensor listening and releases wake lock.
     */
    fun stop() {
        if (isListening) {
            sensorManager?.unregisterListener(this)
            isListening = false
        }
        releaseWakeLock()
        isNear = false
    }

    /**
     * Complete audio routing reset and wake lock release on call destruction.
     */
    fun release() {
        stop()
        proximityWakeLock = null

        val am = audioManager
        if (am != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                am.clearCommunicationDevice()
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest?.let { am.abandonAudioFocusRequest(it) }
                audioFocusRequest = null
            } else {
                @Suppress("DEPRECATION")
                am.abandonAudioFocus(null)
            }
            am.mode = AudioManager.MODE_NORMAL
        }
    }
}
