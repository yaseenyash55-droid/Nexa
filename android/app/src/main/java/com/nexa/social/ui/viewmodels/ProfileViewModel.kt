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
}
