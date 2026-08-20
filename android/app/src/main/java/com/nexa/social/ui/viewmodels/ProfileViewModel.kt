package com.nexa.social.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexa.social.data.models.User
import com.nexa.social.data.repository.UserRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class ProfileUiState {
    object Loading : ProfileUiState()
    data class Success(val user: User) : ProfileUiState()
    data class Error(val message: String) : ProfileUiState()
}

class ProfileViewModel(private val repository: UserRepository = UserRepository()) : ViewModel() {

    private val _uiState = MutableStateFlow<ProfileUiState>(ProfileUiState.Loading)
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    fun loadProfile(username: String) {
        viewModelScope.launch {
            _uiState.value = ProfileUiState.Loading
            repository.getProfile(username).onSuccess { user ->
                _uiState.value = ProfileUiState.Success(user)
            }.onFailure { exception ->
                _uiState.value = ProfileUiState.Error(exception.message ?: "Failed to load profile")
            }
        }
    }

    fun updateProfileLocally(user: User) {
        _uiState.value = ProfileUiState.Success(user)
    }

    fun toggleFollow(user: User, isCurrentlyFollowing: Boolean) {
        viewModelScope.launch {
            val res = if (isCurrentlyFollowing) {
                repository.unfollowUser(user.userId)
            } else {
                repository.followUser(user.userId)
            }
            res.onSuccess {
                val newCount = if (isCurrentlyFollowing) maxOf(0, user.followersCount - 1) else user.followersCount + 1
                _uiState.value = ProfileUiState.Success(user.copy(followersCount = newCount))
            }
        }
    }
}
