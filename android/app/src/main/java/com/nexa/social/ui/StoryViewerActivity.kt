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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityStoryViewerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val mediaUrl = intent.getStringExtra(EXTRA_MEDIA_URL)
        val avatarUrl = intent.getStringExtra(EXTRA_AVATAR_URL)
        val authorName = intent.getStringExtra(EXTRA_AUTHOR_NAME).orEmpty()
        val caption = intent.getStringExtra(EXTRA_CAPTION).orEmpty()

        binding.tvAuthorName.text = authorName
        binding.ivStoryMedia.load(MediaUrlResolver.resolve(mediaUrl)) {
            crossfade(true)
            error(R.drawable.ic_profile)
        }
        binding.ivAuthorAvatar.load(MediaUrlResolver.resolve(avatarUrl)) {
            crossfade(true)
            placeholder(R.drawable.ic_profile)
            error(R.drawable.ic_profile)
            transformations(CircleCropTransformation())
        }
        binding.tvCaption.text = caption
        binding.tvCaption.visibility = if (caption.isBlank()) View.GONE else View.VISIBLE
        binding.btnClose.setOnClickListener { finish() }
    }

    companion object {
        private const val EXTRA_MEDIA_URL = "storyMediaUrl"
        private const val EXTRA_AVATAR_URL = "storyAvatarUrl"
        private const val EXTRA_AUTHOR_NAME = "storyAuthorName"
        private const val EXTRA_CAPTION = "storyCaption"

        fun createIntent(context: Context, story: Story): Intent = Intent(context, StoryViewerActivity::class.java).apply {
            putExtra(EXTRA_MEDIA_URL, story.mediaUrl)
            putExtra(EXTRA_AVATAR_URL, story.author.profileImageUrl)
            putExtra(EXTRA_AUTHOR_NAME, story.author.displayName?.ifBlank { "@${story.author.username}" } ?: "@${story.author.username}")
            putExtra(EXTRA_CAPTION, story.caption)
        }
    }
}
