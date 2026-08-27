package com.nexa.social.ui.adapters

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.view.GestureDetector
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.nexa.social.NexaApiClient
import com.nexa.social.R
import com.nexa.social.data.models.Post
import com.nexa.social.databinding.ItemPostBinding
import com.nexa.social.utils.PreferenceManager

class PostAdapter(
    private val onLikeClick: (Post) -> Unit,
    private val onCommentClick: (Post) -> Unit,
    private val onBookmarkClick: (Post) -> Unit,
    private val onDeleteClick: ((Post) -> Unit)? = null
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
            val context = binding.root.context
            val prefManager = PreferenceManager(context)
            val currentUserId = prefManager.userId
            val currentUsername = prefManager.username

            val isOwner = (currentUserId > 0 && (post.userId == currentUserId || post.author.userId == currentUserId)) ||
                    (!currentUsername.isNullOrEmpty() && post.author.username == currentUsername)

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

            // Post Image / Media
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
            binding.btnLike.setImageResource(R.drawable.ic_heart)
            binding.btnLike.setColorFilter(if (post.isLiked) Color.parseColor("#10B981") else Color.WHITE)
            binding.btnLike.setOnClickListener { onLikeClick(post) }
            binding.btnComment.setOnClickListener { onCommentClick(post) }
            binding.btnBookmark.setOnClickListener { onBookmarkClick(post) }
            binding.btnShare.setOnClickListener { sharePost(post, context) }

            // 3-dots More Options Menu
            binding.btnMoreOptions.setOnClickListener {
                showPostOptionsMenu(post, isOwner, context)
            }

            val gestures = GestureDetector(binding.root.context,
                object : GestureDetector.SimpleOnGestureListener() {
                    override fun onDown(e: MotionEvent): Boolean = true
                    override fun onDoubleTap(e: MotionEvent): Boolean {
                        if (!post.isLiked) onLikeClick(post)
                        binding.btnLike.setColorFilter(Color.parseColor("#10B981"))
                        binding.btnLike.animate().scaleX(1.45f).scaleY(1.45f).setDuration(120).withEndAction {
                            binding.btnLike.animate().scaleX(1f).scaleY(1f).setDuration(120).start()
                        }.start()

                        binding.ivHeartOverlay.apply {
                            visibility = View.VISIBLE
                            alpha = 0f
                            scaleX = 0f
                            scaleY = 0f
                            animate()
                                .alpha(1f)
                                .scaleX(1.3f)
                                .scaleY(1.3f)
                                .setDuration(250)
                                .withEndAction {
                                    animate()
                                        .alpha(0f)
                                        .scaleX(0.8f)
                                        .scaleY(0.8f)
                                        .setDuration(250)
                                        .setStartDelay(150)
                                        .withEndAction {
                                            visibility = View.GONE
                                        }
                                        .start()
                                }
                                .start()
                        }
                        return true
                    }
                })
            binding.ivPostImage.setOnTouchListener { view, event ->
                val handled = gestures.onTouchEvent(event)
                if (event.action == MotionEvent.ACTION_UP && !handled) view.performClick()
                handled
            }
        }

        private fun sharePost(post: Post, context: Context) {
            val shareText = buildString {
                if (!post.content.isNullOrBlank()) append(post.content)
                if (!post.imageUrl.isNullOrBlank()) {
                    if (isNotEmpty()) append("\n")
                    append(post.imageUrl)
                }
            }
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, shareText)
            }
            context.startActivity(Intent.createChooser(intent, "Share NEXA post"))
        }

        private fun showPostOptionsMenu(post: Post, isOwner: Boolean, context: Context) {
            val options = mutableListOf(
                "📋 Copy Text",
                "🔗 Share Post Link",
                "📌 ${if (post.isBookmarked) "Remove Bookmark" else "Save / Bookmark"}"
            )
            if (isOwner) {
                options.add("🗑️ Delete Post")
            } else {
                options.add("🚩 Report Post")
            }

            AlertDialog.Builder(context)
                .setTitle("Post Options")
                .setItems(options.toTypedArray()) { _, which ->
                    when (options[which]) {
                        "📋 Copy Text" -> {
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            val clip = ClipData.newPlainText("Post Content", post.content)
                            clipboard.setPrimaryClip(clip)
                            Toast.makeText(context, "Post text copied to clipboard", Toast.LENGTH_SHORT).show()
                        }
                        "🔗 Share Post Link" -> {
                            sharePost(post, context)
                        }
                        "📌 Save / Bookmark", "📌 Remove Bookmark" -> {
                            onBookmarkClick(post)
                        }
                        "🗑️ Delete Post" -> {
                            AlertDialog.Builder(context)
                                .setTitle("Delete Post")
                                .setMessage("Are you sure you want to permanently delete this post?")
                                .setPositiveButton("Delete") { _, _ ->
                                    onDeleteClick?.invoke(post)
                                }
                                .setNegativeButton("Cancel", null)
                                .show()
                        }
                        "🚩 Report Post" -> {
                            Toast.makeText(context, "Thank you. Post reported for review.", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

    class PostDiffCallback : DiffUtil.ItemCallback<Post>() {
        override fun areItemsTheSame(oldItem: Post, newItem: Post): Boolean = oldItem.postId == newItem.postId
        override fun areContentsTheSame(oldItem: Post, newItem: Post): Boolean = oldItem == newItem
    }
}
