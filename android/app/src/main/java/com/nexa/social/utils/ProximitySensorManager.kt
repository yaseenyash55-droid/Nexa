package com.nexa.social.utils

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.PowerManager
import android.util.Log

/**
 * Nexa Proximity Sensor & Screen Lock Manager
 *
 * Manages device proximity detection during voice and handheld calls,
 * acquiring PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK when the phone is held
 * close to the user's ear to prevent accidental touch inputs, and releasing
 * the wake lock immediately when moved away, on speakerphone/video toggle, or call termination.
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
    private val proximitySensor: Sensor? = sensorManager?.getDefaultSensor(Sensor.TYPE_PROXIMITY)

    private var proximityWakeLock: PowerManager.WakeLock? = null
    private var isListening = false
    private var isNear = false
    private var isEnabled = false

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
                Log.w(TAG, "PROXIMITY_SCREEN_OFF_WAKE_LOCK is not supported on this device.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize proximity wake lock", e)
        }
    }

    /**
     * Activates proximity tracking during active calls.
     * Should only be active when speakerphone is OFF and video is OFF (or in voice mode).
     */
    fun start(allowScreenOff: Boolean = true) {
        this.isEnabled = allowScreenOff
        if (proximitySensor == null || isListening) return

        sensorManager?.registerListener(
            this,
            proximitySensor,
            SensorManager.SENSOR_DELAY_NORMAL
        )
        isListening = true
    }

    /**
     * Updates whether proximity screen-off lock should be actively permitted
     * (e.g. disable when user toggles on Speakerphone or Video camera).
     */
    fun updateState(allowScreenOff: Boolean) {
        this.isEnabled = allowScreenOff
        if (!allowScreenOff) {
            releaseWakeLock()
        } else if (isNear) {
            acquireWakeLock()
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
        } else {
            releaseWakeLock()
        }

        onProximityChanged?.invoke(isNear)
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun acquireWakeLock() {
        try {
            proximityWakeLock?.let { lock ->
                if (!lock.isHeld) {
                    lock.acquire(60 * 60 * 1000L /* 1 hour fallback timeout */)
                    Log.d(TAG, "Proximity wake lock acquired (Screen turned off near ear)")
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
     * Stops sensor listening and guarantees complete release of the wake lock.
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
     * Full teardown on activity destruction.
     */
    fun release() {
        stop()
        proximityWakeLock = null
    }
}
