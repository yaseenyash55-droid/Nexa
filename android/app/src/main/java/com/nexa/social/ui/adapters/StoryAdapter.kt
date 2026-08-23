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
    private val currentUserId: Int,
    private val onAddStory: () -> Unit,
    private val onStoryClick: (List<Story>) -> Unit
) : RecyclerView.Adapter<StoryAdapter.StoryViewHolder>() {

    private var ownStories: List<Story> = emptyList()
    private var storyGroups: List<List<Story>> = emptyList()

    init {
        setHasStableIds(true)
    }

    fun submitStories(items: List<Story>) {
        val groupedStories = items
            .groupBy { it.userId }
            .values
            .map { group -> group.sortedBy { it.createdAt.orEmpty() } }

        ownStories = groupedStories.firstOrNull { it.firstOrNull()?.userId == currentUserId }.orEmpty()
        storyGroups = groupedStories.filterNot { it.firstOrNull()?.userId == currentUserId }
        notifyDataSetChanged()
    }

    override fun getItemCount(): Int = storyGroups.size + 1

    override fun getItemId(position: Int): Long = if (position == 0) {
        Long.MIN_VALUE
    } else {
        storyGroups[position - 1].first().userId.toLong()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): StoryViewHolder {
        val binding = ItemStoryBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return StoryViewHolder(binding)
    }

    override fun onBindViewHolder(holder: StoryViewHolder, position: Int) {
        if (position == 0) holder.bindYourStory(ownStories) else holder.bindStoryGroup(storyGroups[position - 1])
    }

    inner class StoryViewHolder(private val binding: ItemStoryBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bindYourStory(stories: List<Story>) {
            binding.tvStoryUsername.text = "Your story"
            binding.tvAddBadge.visibility = View.VISIBLE
            val ownStory = stories.lastOrNull()
            val avatarUrl = MediaUrlResolver.resolve(ownStory?.author?.profileImageUrl)
            binding.ivStoryAvatar.load(avatarUrl) {
                crossfade(true)
                placeholder(R.drawable.ic_profile)
                error(R.drawable.ic_profile)
                transformations(CircleCropTransformation())
            }
            binding.tvAddBadge.setOnClickListener { onAddStory() }
            binding.root.setOnClickListener {
                if (stories.isEmpty()) onAddStory() else onStoryClick(stories)
            }
        }

        fun bindStoryGroup(stories: List<Story>) {
            val story = stories.first()
            binding.tvStoryUsername.text = story.author.username
            binding.tvAddBadge.visibility = View.GONE
            val previewUrl = MediaUrlResolver.resolve(story.author.profileImageUrl ?: story.mediaUrl)
            binding.ivStoryAvatar.load(previewUrl) {
                crossfade(true)
                placeholder(R.drawable.ic_profile)
                error(R.drawable.ic_profile)
                transformations(CircleCropTransformation())
            }
            binding.tvAddBadge.setOnClickListener(null)
            binding.root.setOnClickListener { onStoryClick(stories) }
        }
    }
}
