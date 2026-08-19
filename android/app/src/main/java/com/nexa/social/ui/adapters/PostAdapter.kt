package com.nexa.social.ui.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.nexa.social.NexaApiClient
import com.nexa.social.R
import com.nexa.social.data.models.Post
import com.nexa.social.databinding.ItemPostBinding

class PostAdapter(
    private val onLikeClick: (Post) -> Unit,
    private val onCommentClick: (Post) -> Unit,
    private val onBookmarkClick: (Post) -> Unit
) : ListAdapter<Post, PostAdapter.PostViewHolder>(PostDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PostViewHolder {
        val binding = ItemPostBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return PostViewHolder(binding)
    }

    override fun onBindViewHolder(holder: PostViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class PostViewHolder(private val binding: ItemPostBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(post: Post) {
            binding.tvDisplayName.text = post.author.displayName
            binding.tvUsername.text = "@${post.author.username}"
            binding.tvContent.text = post.content
            binding.tvLikesCount.text = post.likesCount.toString()
            binding.tvCommentsCount.text = post.commentsCount.toString()
            binding.tvTimestamp.text = post.createdAt

            // Avatar
            val avatarUrl = post.author.profileImageUrl?.let {
                if (it.startsWith("http")) it else "${NexaApiClient.BASE_URL.removeSuffix("api/")}${it.removePrefix("/")}"
            }
            binding.ivAvatar.load(avatarUrl) {
                crossfade(true)
                placeholder(R.drawable.ic_profile)
                error(R.drawable.ic_profile)
                transformations(CircleCropTransformation())
            }

            // Post Image
            if (!post.imageUrl.isNullOrEmpty()) {
                binding.ivPostImage.visibility = View.VISIBLE
                val imageUrl = if (post.imageUrl.startsWith("http")) post.imageUrl else "${NexaApiClient.BASE_URL.removeSuffix("api/")}${post.imageUrl.removePrefix("/")}"
                binding.ivPostImage.load(imageUrl) {
                    crossfade(true)
                }
            } else {
                binding.ivPostImage.visibility = View.GONE
            }

            // Like status
            binding.btnLike.setImageResource(if (post.isLiked == true) R.drawable.ic_heart else R.drawable.ic_heart) // Need active heart icon
            binding.btnLike.setOnClickListener { onLikeClick(post) }
            binding.btnComment.setOnClickListener { onCommentClick(post) }
            binding.btnBookmark.setOnClickListener { onBookmarkClick(post) }
        }
    }

    class PostDiffCallback : DiffUtil.ItemCallback<Post>() {
        override fun areItemsTheSame(oldItem: Post, newItem: Post): Boolean = oldItem.postId == newItem.postId
        override fun areContentsTheSame(oldItem: Post, newItem: Post): Boolean = oldItem == newItem
    }
}
