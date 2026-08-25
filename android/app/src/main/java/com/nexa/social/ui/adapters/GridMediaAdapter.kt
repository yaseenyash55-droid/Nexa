package com.nexa.social.ui.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.nexa.social.NexaApiClient
import com.nexa.social.R
import com.nexa.social.data.models.Post
import com.nexa.social.databinding.ItemGridMediaBinding

class GridMediaAdapter(
    private val onMediaClick: (Post) -> Unit
) : ListAdapter<Post, GridMediaAdapter.GridMediaViewHolder>(GridDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): GridMediaViewHolder {
        val binding = ItemGridMediaBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return GridMediaViewHolder(binding)
    }

    override fun onBindViewHolder(holder: GridMediaViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class GridMediaViewHolder(private val binding: ItemGridMediaBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(post: Post) {
            val mediaUrl = post.imageUrl
            val isVideo = mediaUrl?.let {
                it.contains("video", ignoreCase = true) ||
                it.endsWith(".mp4", ignoreCase = true) ||
                it.endsWith(".webm", ignoreCase = true) ||
                it.endsWith(".mov", ignoreCase = true)
            } ?: false

            if (!mediaUrl.isNullOrEmpty()) {
                binding.ivGridThumbnail.visibility = View.VISIBLE
                binding.tvGridTextSnippet.visibility = View.GONE
                val fullUrl = if (mediaUrl.startsWith("http")) mediaUrl else "${NexaApiClient.BASE_URL.removeSuffix("api/")}${mediaUrl.removePrefix("/")}"
                binding.ivGridThumbnail.load(fullUrl) {
                    crossfade(true)
                    placeholder(R.drawable.ic_gallery)
                    error(R.drawable.ic_gallery)
                }
                binding.badgeVideo.visibility = if (isVideo) View.VISIBLE else View.GONE
            } else {
                binding.ivGridThumbnail.visibility = View.GONE
                binding.badgeVideo.visibility = View.GONE
                binding.tvGridTextSnippet.visibility = View.VISIBLE
                binding.tvGridTextSnippet.text = post.content?.take(60) ?: ""
            }

            binding.root.setOnClickListener {
                onMediaClick(post)
            }
        }
    }

    class GridDiffCallback : DiffUtil.ItemCallback<Post>() {
        override fun areItemsTheSame(oldItem: Post, newItem: Post): Boolean = oldItem.postId == newItem.postId
        override fun areContentsTheSame(oldItem: Post, newItem: Post): Boolean = oldItem == newItem
    }
}
