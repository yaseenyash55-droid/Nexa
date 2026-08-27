package com.nexa.social.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import coil.load
import coil.transform.CircleCropTransformation
import com.nexa.social.R
import com.nexa.social.data.models.Story
import com.nexa.social.databinding.ActivityStoryViewerBinding
import com.nexa.social.utils.MediaUrlResolver

class StoryViewerActivity : AppCompatActivity() {
    private lateinit var binding: ActivityStoryViewerBinding
    private var storyUrls: List<String> = emptyList()
    private var storyCaptions: List<String> = emptyList()
    private var storyMusicTrackIds: List<String> = emptyList()
    private var currentStoryIndex = 0

    private var mediaPlayer: android.media.MediaPlayer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityStoryViewerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val avatarUrl = intent.getStringExtra(EXTRA_AVATAR_URL)
        val authorName = intent.getStringExtra(EXTRA_AUTHOR_NAME).orEmpty()
        storyUrls = intent.getStringArrayListExtra(EXTRA_MEDIA_URLS).orEmpty().filter { it.isNotBlank() }
        storyCaptions = intent.getStringArrayListExtra(EXTRA_CAPTIONS).orEmpty()
        storyMusicTrackIds = intent.getStringArrayListExtra(EXTRA_MUSIC_TRACK_IDS).orEmpty()

        if (storyUrls.isEmpty()) {
            finish()
            return
        }

        binding.tvAuthorName.text = authorName
        binding.ivAuthorAvatar.load(MediaUrlResolver.resolve(avatarUrl)) {
            crossfade(true)
            placeholder(R.drawable.ic_profile)
            error(R.drawable.ic_profile)
            transformations(CircleCropTransformation())
        }
        binding.btnClose.setOnClickListener { finish() }
        binding.ivStoryMedia.setOnClickListener { showNextStory() }
        renderStory()
    }

    private fun renderStory() {
        // Stop current playback
        stopMusic()

        val caption = storyCaptions.getOrNull(currentStoryIndex).orEmpty()
        binding.ivStoryMedia.load(MediaUrlResolver.resolve(storyUrls[currentStoryIndex])) {
            crossfade(true)
            error(R.drawable.ic_profile)
        }
        binding.tvCaption.text = caption
        binding.tvCaption.visibility = if (caption.isBlank()) View.GONE else View.VISIBLE
        binding.tvStoryProgress.text = "${currentStoryIndex + 1} / ${storyUrls.size}"

        val trackId = storyMusicTrackIds.getOrNull(currentStoryIndex).orEmpty()
        if (trackId.isNotBlank()) {
            loadAndPlayMusic(trackId)
        } else {
            binding.layoutMusicSticker.visibility = View.GONE
        }
    }

    private fun loadAndPlayMusic(trackId: String) {
        androidx.lifecycle.lifecycleScope.launchWhenStarted {
            try {
                val response = com.nexa.social.NexaApiClient.spotifyApi.getTrackDetails(trackId)
                val body = response.body()
                if (response.isSuccessful && body?.data != null) {
                    val track = body.data
                    binding.layoutMusicSticker.visibility = View.VISIBLE
                    binding.tvStickerTitle.text = track.name
                    binding.tvStickerArtist.text = track.getArtistNames()
                    val thumb = track.getThumbnailUrl()
                    if (!thumb.isNullOrEmpty()) {
                        coil.imageLoader(this@StoryViewerActivity).enqueue(
                            coil.request.ImageRequest.Builder(this@StoryViewerActivity)
                                .data(thumb)
                                .target(binding.ivStickerArt)
                                .build()
                        )
                    }

                    val previewUrl = track.previewUrl
                    if (!previewUrl.isNullOrBlank()) {
                        playMusic(previewUrl)
                    }
                } else {
                    binding.layoutMusicSticker.visibility = View.GONE
                }
            } catch (e: Exception) {
                binding.layoutMusicSticker.visibility = View.GONE
            }
        }
    }

    private fun playMusic(url: String) {
        try {
            mediaPlayer = android.media.MediaPlayer().apply {
                setDataSource(url)
                setAudioAttributes(
                    android.media.AudioAttributes.Builder()
                        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
                        .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                        .build()
                )
                isLooping = true
                setOnPreparedListener { start() }
                prepareAsync()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopMusic() {
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            mediaPlayer = null
        }
    }

    private fun showNextStory() {
        if (currentStoryIndex >= storyUrls.lastIndex) {
            finish()
            return
        }
        currentStoryIndex += 1
        renderStory()
    }

    override fun onPause() {
        super.onPause()
        stopMusic()
    }

    override fun onDestroy() {
        super.onDestroy()
        stopMusic()
    }

    companion object {
        private const val EXTRA_MEDIA_URLS = "storyMediaUrls"
        private const val EXTRA_AVATAR_URL = "storyAvatarUrl"
        private const val EXTRA_AUTHOR_NAME = "storyAuthorName"
        private const val EXTRA_CAPTIONS = "storyCaptions"
        private const val EXTRA_MUSIC_TRACK_IDS = "storyMusicTrackIds"

        fun createIntent(context: Context, stories: List<Story>): Intent {
            require(stories.isNotEmpty()) { "At least one cosmic is required" }
            val author = stories.first().author
            return Intent(context, StoryViewerActivity::class.java).apply {
                putStringArrayListExtra(EXTRA_MEDIA_URLS, ArrayList(stories.map { it.mediaUrl }))
                putStringArrayListExtra(EXTRA_CAPTIONS, ArrayList(stories.map { it.caption.orEmpty() }))
                putStringArrayListExtra(EXTRA_MUSIC_TRACK_IDS, ArrayList(stories.map { it.musicTrackId.orEmpty() }))
                putExtra(EXTRA_AVATAR_URL, author.profileImageUrl)
                val displayName = author.displayName
                putExtra(EXTRA_AUTHOR_NAME, if (!displayName.isNullOrBlank()) displayName else "@${author.username}")
            }
        }
    }
}
