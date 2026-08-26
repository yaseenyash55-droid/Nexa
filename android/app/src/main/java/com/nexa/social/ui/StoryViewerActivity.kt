package com.nexa.social.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
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
    private var currentStoryIndex = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityStoryViewerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val avatarUrl = intent.getStringExtra(EXTRA_AVATAR_URL)
        val authorName = intent.getStringExtra(EXTRA_AUTHOR_NAME).orEmpty()
        storyUrls = intent.getStringArrayListExtra(EXTRA_MEDIA_URLS).orEmpty().filter { it.isNotBlank() }
        storyCaptions = intent.getStringArrayListExtra(EXTRA_CAPTIONS).orEmpty()

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
        val caption = storyCaptions.getOrNull(currentStoryIndex).orEmpty()
        binding.ivStoryMedia.load(MediaUrlResolver.resolve(storyUrls[currentStoryIndex])) {
            crossfade(true)
            error(R.drawable.ic_profile)
        }
        binding.tvCaption.text = caption
        binding.tvCaption.visibility = if (caption.isBlank()) View.GONE else View.VISIBLE
        binding.tvStoryProgress.text = "${currentStoryIndex + 1} / ${storyUrls.size}"
    }

    private fun showNextStory() {
        if (currentStoryIndex >= storyUrls.lastIndex) {
            finish()
            return
        }
        currentStoryIndex += 1
        renderStory()
    }

    companion object {
        private const val EXTRA_MEDIA_URLS = "storyMediaUrls"
        private const val EXTRA_AVATAR_URL = "storyAvatarUrl"
        private const val EXTRA_AUTHOR_NAME = "storyAuthorName"
        private const val EXTRA_CAPTIONS = "storyCaptions"

        fun createIntent(context: Context, stories: List<Story>): Intent {
            require(stories.isNotEmpty()) { "At least one cosmic is required" }
            val author = stories.first().author
            return Intent(context, StoryViewerActivity::class.java).apply {
                putStringArrayListExtra(EXTRA_MEDIA_URLS, ArrayList(stories.map { it.mediaUrl }))
                putStringArrayListExtra(EXTRA_CAPTIONS, ArrayList(stories.map { it.caption.orEmpty() }))
                putExtra(EXTRA_AVATAR_URL, author.profileImageUrl)
                val displayName = author.displayName
                putExtra(EXTRA_AUTHOR_NAME, if (!displayName.isNullOrBlank()) displayName else "@${author.username}")
            }
        }
    }
}
