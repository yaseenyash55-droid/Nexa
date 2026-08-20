package com.nexa.social.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexa.social.data.models.Post
import com.nexa.social.data.repository.PostRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class HomeUiState {
    object Loading : HomeUiState()
    data class Success(val posts: List<Post>, val hasMore: Boolean = true) : HomeUiState()
    object Empty : HomeUiState()
    data class Error(val message: String) : HomeUiState()
}

class HomeViewModel(private val repository: PostRepository = PostRepository()) : ViewModel() {

    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private var currentPosts: MutableList<Post> = mutableListOf()
    private var currentOffset: Int = 0
    private var isLoadingMore: Boolean = false
    private val pageSize: Int = 20

    init {
        loadFeed()
    }

    fun loadFeed(isRefresh: Boolean = false, isLoadMore: Boolean = false) {
        if (isLoadMore && (isLoadingMore || _uiState.value is HomeUiState.Loading)) return

        viewModelScope.launch {
            if (isRefresh) {
                currentOffset = 0
            } else if (isLoadMore) {
                isLoadingMore = true
            } else if (currentPosts.isEmpty()) {
                _uiState.value = HomeUiState.Loading
            }

            repository.getFeed(limit = pageSize, offset = if (isLoadMore) currentOffset else 0).onSuccess { posts ->
                if (isRefresh || !isLoadMore) {
                    currentPosts = posts.toMutableList()
                    currentOffset = posts.size
                } else {
                    currentPosts.addAll(posts)
                    currentOffset += posts.size
                }
                isLoadingMore = false
                if (currentPosts.isEmpty()) {
                    _uiState.value = HomeUiState.Empty
                } else {
                    _uiState.value = HomeUiState.Success(currentPosts.toList(), hasMore = posts.size >= pageSize)
                }
            }.onFailure { exception ->
                isLoadingMore = false
                if (currentPosts.isEmpty()) {
                    _uiState.value = HomeUiState.Error(exception.message ?: "Failed to load feed")
                }
            }
        }
    }

    fun toggleLike(post: Post) {
        val isCurrentlyLiked = post.isLiked == true
        val newLiked = !isCurrentlyLiked
        val newCount = if (newLiked) post.likesCount + 1 else maxOf(0, post.likesCount - 1)

        // Optimistic UI update
        val index = currentPosts.indexOfFirst { it.postId == post.postId }
        if (index != -1) {
            val updatedPost = post.copy(isLiked = newLiked, likesCount = newCount)
            currentPosts[index] = updatedPost
            _uiState.value = HomeUiState.Success(currentPosts.toList())
        }

        viewModelScope.launch {
            val result = if (newLiked) {
                repository.likePost(post.postId)
            } else {
                repository.unlikePost(post.postId)
            }

            result.onFailure {
                // Rollback on failure
                if (index != -1) {
                    currentPosts[index] = post
                    _uiState.value = HomeUiState.Success(currentPosts.toList())
                }
            }
        }
    }

    fun toggleBookmark(post: Post) {
        val isCurrentlyBookmarked = post.isBookmarked == true
        val newBookmarked = !isCurrentlyBookmarked

        val index = currentPosts.indexOfFirst { it.postId == post.postId }
        if (index != -1) {
            val updatedPost = post.copy(isBookmarked = newBookmarked)
            currentPosts[index] = updatedPost
            _uiState.value = HomeUiState.Success(currentPosts.toList())
        }

        viewModelScope.launch {
            val result = if (newBookmarked) {
                repository.bookmarkPost(post.postId)
            } else {
                repository.unbookmarkPost(post.postId)
            }

            result.onFailure {
                if (index != -1) {
                    currentPosts[index] = post
                    _uiState.value = HomeUiState.Success(currentPosts.toList())
                }
            }
        }
    }
}
