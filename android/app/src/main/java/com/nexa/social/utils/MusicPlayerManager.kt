package com.nexa.social.utils

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import com.nexa.social.data.models.MusicTrack

object MusicPlayerManager {

    private var mediaPlayer: MediaPlayer? = null
    var currentTrack: MusicTrack? = null
        private set

    private var _isPlaying: Boolean = false
    val isPlaying: Boolean
        get() = _isPlaying

    var queue: List<MusicTrack> = emptyList()
        private set

    private val listeners = mutableListOf<PlayerListener>()
    private val handler = Handler(Looper.getMainLooper())
    private var progressRunnable: Runnable? = null

    interface PlayerListener {
        fun onTrackChanged(track: MusicTrack?)
        fun onPlaybackStateChanged(isPlaying: Boolean)
        fun onProgressUpdate(currentPositionMs: Long, durationMs: Long)
    }

    fun addListener(listener: PlayerListener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener)
            listener.onTrackChanged(currentTrack)
            listener.onPlaybackStateChanged(_isPlaying)
        }
    }

    fun removeListener(listener: PlayerListener) {
        listeners.remove(listener)
    }

    fun playTrack(context: Context, track: MusicTrack, newQueue: List<MusicTrack> = emptyList()) {
        if (newQueue.isNotEmpty()) {
            queue = newQueue
        }

        try {
            stopProgressUpdates()
            mediaPlayer?.release()
            mediaPlayer = null

            currentTrack = track
            listeners.forEach { it.onTrackChanged(track) }

            val player = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build()
                )
                setDataSource(track.audioUrl)
                setOnPreparedListener { mp ->
                    mp.start()
                    _isPlaying = true
                    listeners.forEach { it.onPlaybackStateChanged(true) }
                    startProgressUpdates()
                }
                setOnCompletionListener {
                    _isPlaying = false
                    listeners.forEach { it.onPlaybackStateChanged(false) }
                    playNext(context)
                }
                setOnErrorListener { _, _, _ ->
                    _isPlaying = false
                    listeners.forEach { it.onPlaybackStateChanged(false) }
                    true
                }
                prepareAsync()
            }
            mediaPlayer = player
        } catch (e: Exception) {
            e.printStackTrace()
            _isPlaying = false
            listeners.forEach { it.onPlaybackStateChanged(false) }
        }
    }

    fun togglePlayPause(context: Context) {
        val player = mediaPlayer
        if (player == null && currentTrack != null) {
            playTrack(context, currentTrack!!, queue)
            return
        }

        if (player != null) {
            if (player.isPlaying) {
                player.pause()
                _isPlaying = false
                stopProgressUpdates()
                listeners.forEach { it.onPlaybackStateChanged(false) }
            } else {
                player.start()
                _isPlaying = true
                startProgressUpdates()
                listeners.forEach { it.onPlaybackStateChanged(true) }
            }
        }
    }

    fun pause() {
        mediaPlayer?.let { player ->
            if (player.isPlaying) {
                player.pause()
                _isPlaying = false
                stopProgressUpdates()
                listeners.forEach { it.onPlaybackStateChanged(false) }
            }
        }
    }

    fun resume() {
        mediaPlayer?.let { player ->
            if (!player.isPlaying) {
                player.start()
                _isPlaying = true
                startProgressUpdates()
                listeners.forEach { it.onPlaybackStateChanged(true) }
            }
        }
    }

    fun seekTo(positionMs: Long) {
        mediaPlayer?.seekTo(positionMs.toInt())
    }

    fun playNext(context: Context) {
        val track = currentTrack ?: return
        if (queue.isEmpty()) return
        val currentIndex = queue.indexOfFirst { it.id == track.id }
        if (currentIndex >= 0 && currentIndex < queue.size - 1) {
            playTrack(context, queue[currentIndex + 1], queue)
        } else if (queue.isNotEmpty()) {
            playTrack(context, queue[0], queue)
        }
    }

    fun playPrevious(context: Context) {
        val track = currentTrack ?: return
        if (queue.isEmpty()) return
        val currentIndex = queue.indexOfFirst { it.id == track.id }
        if (currentIndex > 0) {
            playTrack(context, queue[currentIndex - 1], queue)
        }
    }

    fun stop() {
        stopProgressUpdates()
        mediaPlayer?.release()
        mediaPlayer = null
        currentTrack = null
        _isPlaying = false
        listeners.forEach {
            it.onTrackChanged(null)
            it.onPlaybackStateChanged(false)
        }
    }

    fun getCurrentPositionMs(): Long {
        return try {
            mediaPlayer?.currentPosition?.toLong() ?: 0L
        } catch (_: Exception) {
            0L
        }
    }

    fun getDurationMs(): Long {
        return try {
            mediaPlayer?.duration?.toLong() ?: 0L
        } catch (_: Exception) {
            0L
        }
    }

    private fun startProgressUpdates() {
        stopProgressUpdates()
        progressRunnable = object : Runnable {
            override fun run() {
                val current = getCurrentPositionMs()
                val duration = getDurationMs()
                listeners.forEach { it.onProgressUpdate(current, duration) }
                handler.postDelayed(this, 500)
            }
        }
        handler.post(progressRunnable!!)
    }

    private fun stopProgressUpdates() {
        progressRunnable?.let { handler.removeCallbacks(it) }
        progressRunnable = null
    }
}
