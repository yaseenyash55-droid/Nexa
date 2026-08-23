package com.nexa.social.ui.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.nexa.social.R
import com.nexa.social.data.models.Story
import com.nexa.social.databinding.ItemStoryBinding
import com.nexa.social.utils.MediaUrlResolver

class StoryAdapter(
    private val onAddStory: () -> Unit,
    private val onStoryClick: (Story) -> Unit
) : RecyclerView.Adapter<StoryAdapter.StoryViewHolder>() {

    private var stories: List<Story> = emptyList()

    init {
        setHasStableIds(true)
    }

    fun submitStories(items: List<Story>) {
        stories = items
        notifyDataSetChanged()
    }

    override fun getItemCount(): Int = stories.size + 1

    override fun getItemId(position: Int): Long = if (position == 0) Long.MIN_VALUE else stories[position - 1].storyId.toLong()

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): StoryViewHolder {
        val binding = ItemStoryBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return StoryViewHolder(binding)
    }

    override fun onBindViewHolder(holder: StoryViewHolder, position: Int) {
        if (position == 0) holder.bindAdd() else holder.bindStory(stories[position - 1])
    }

    inner class StoryViewHolder(private val binding: ItemStoryBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bindAdd() {
            binding.tvStoryUsername.text = "Your story"
            binding.tvAddBadge.visibility = View.VISIBLE
            binding.ivStoryAvatar.setImageResource(R.drawable.ic_profile)
            binding.root.setOnClickListener { onAddStory() }
        }

        fun bindStory(story: Story) {
            binding.tvStoryUsername.text = story.author.username
            binding.tvAddBadge.visibility = View.GONE
            val previewUrl = MediaUrlResolver.resolve(story.author.profileImageUrl ?: story.mediaUrl)
            binding.ivStoryAvatar.load(previewUrl) {
                crossfade(true)
                placeholder(R.drawable.ic_profile)
                error(R.drawable.ic_profile)
                transformations(CircleCropTransformation())
            }
            binding.root.setOnClickListener { onStoryClick(story) }
        }
    }
}
