package com.nexa.social.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexa.social.data.models.Reel
import com.nexa.social.data.repository.PostRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class ReelsUiState {
    object Loading : ReelsUiState()
    data class Success(val reels: List<Reel>, val hasMore: Boolean = true) : ReelsUiState()
    object Empty : ReelsUiState()
    data class Error(val message: String) : ReelsUiState()
}

class ReelsViewModel(private val repository: PostRepository = PostRepository()) : ViewModel() {

    private val _uiState = MutableStateFlow<ReelsUiState>(ReelsUiState.Loading)
    val uiState: StateFlow<ReelsUiState> = _uiState.asStateFlow()

    private var currentReels: MutableList<Reel> = mutableListOf()
    private var currentOffset: Int = 0
    private var isLoadingMore: Boolean = false
    private val pageSize: Int = 20

    init {
        loadReels()
    }

    fun loadReels(isRefresh: Boolean = false, isLoadMore: Boolean = false) {
        if (isLoadMore && (isLoadingMore || _uiState.value is ReelsUiState.Loading)) return

        viewModelScope.launch {
            if (isRefresh) {
                currentOffset = 0
            } else if (isLoadMore) {
                isLoadingMore = true
            } else if (currentReels.isEmpty()) {
                _uiState.value = ReelsUiState.Loading
            }

            repository.getReels(limit = pageSize, offset = if (isLoadMore) currentOffset else 0).onSuccess { reels ->
                if (isRefresh || !isLoadMore) {
                    currentReels = reels.toMutableList()
                    currentOffset = reels.size
                } else {
                    currentReels.addAll(reels)
                    currentOffset += reels.size
                }
                isLoadingMore = false
                if (currentReels.isEmpty()) {
                    _uiState.value = ReelsUiState.Empty
                } else {
                    _uiState.value = ReelsUiState.Success(currentReels.toList(), hasMore = reels.size >= pageSize)
                }
            }.onFailure { exception ->
                isLoadingMore = false
                if (currentReels.isEmpty()) {
                    _uiState.value = ReelsUiState.Error(exception.message ?: "Failed to load bytes")
                }
            }
        }
    }

    fun toggleLike(reel: Reel) {
        val isCurrentlyLiked = reel.isLiked == true
        val newLiked = !isCurrentlyLiked
        val newCount = if (newLiked) reel.likesCount + 1 else maxOf(0, reel.likesCount - 1)

        val index = currentReels.indexOfFirst { it.reelId == reel.reelId }
        if (index != -1) {
            val updatedReel = reel.copy(isLiked = newLiked, likesCount = newCount)
            currentReels[index] = updatedReel
            _uiState.value = ReelsUiState.Success(currentReels.toList())
        }

        viewModelScope.launch {
            val result = if (newLiked) {
                repository.likeReel(reel.reelId)
            } else {
                repository.unlikeReel(reel.reelId)
            }

            result.onFailure {
                if (index != -1) {
                    currentReels[index] = reel
                    _uiState.value = ReelsUiState.Success(currentReels.toList())
                }
            }
        }
    }
}
