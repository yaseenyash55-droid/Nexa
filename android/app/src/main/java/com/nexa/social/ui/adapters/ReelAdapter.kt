package com.nexa.social.ui.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.Reel
import com.nexa.social.databinding.ItemReelBinding

class ReelAdapter(
    private val onLikeClick: (Reel) -> Unit
) : ListAdapter<Reel, ReelAdapter.ReelViewHolder>(ReelDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ReelViewHolder {
        val binding = ItemReelBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ReelViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ReelViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ReelViewHolder(private val binding: ItemReelBinding) : RecyclerView.ViewHolder(binding.root) {
        private var player: ExoPlayer? = null

        fun bind(reel: Reel) {
            binding.tvAuthor.text = "@${reel.author.username}"
            binding.tvCaption.text = reel.caption
            binding.tvLikesCount.text = reel.likesCount.toString()

            // Initialize player
            player = ExoPlayer.Builder(binding.root.context).build().apply {
                val videoUrl = if (reel.videoUrl.startsWith("http")) reel.videoUrl else "${NexaApiClient.BASE_URL.removeSuffix("api/")}${reel.videoUrl.removePrefix("/")}"
                setMediaItem(MediaItem.fromUri(videoUrl))
                prepare()
                repeatMode = ExoPlayer.REPEAT_MODE_ONE
            }
            binding.playerView.player = player

            binding.btnLike.setOnClickListener { onLikeClick(reel) }
        }

        fun play() {
            player?.playWhenReady = true
            player?.play()
        }

        fun pause() {
            player?.playWhenReady = false
            player?.pause()
        }

        fun release() {
            player?.release()
            player = null
        }
    }

    class ReelDiffCallback : DiffUtil.ItemCallback<Reel>() {
        override fun areItemsTheSame(oldItem: Reel, newItem: Reel): Boolean = oldItem.reelId == newItem.reelId
        override fun areContentsTheSame(oldItem: Reel, newItem: Reel): Boolean = oldItem == newItem
    }
}
