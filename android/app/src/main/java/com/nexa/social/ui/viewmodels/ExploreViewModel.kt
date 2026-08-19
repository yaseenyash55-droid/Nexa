package com.nexa.social.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexa.social.data.models.User
import com.nexa.social.data.repository.UserRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class ExploreUiState {
    object Idle : ExploreUiState()
    object Loading : ExploreUiState()
    data class Success(val users: List<User>) : ExploreUiState()
    data class Error(val message: String) : ExploreUiState()
}

class ExploreViewModel(private val repository: UserRepository = UserRepository()) : ViewModel() {

    private val _uiState = MutableStateFlow<ExploreUiState>(ExploreUiState.Idle)
    val uiState: StateFlow<ExploreUiState> = _uiState.asStateFlow()

    fun search(query: String) {
        if (query.isBlank()) {
            _uiState.value = ExploreUiState.Idle
            return
        }

        viewModelScope.launch {
            _uiState.value = ExploreUiState.Loading
            repository.searchUsers(query).onSuccess { users ->
                _uiState.value = ExploreUiState.Success(users)
            }.onFailure { exception ->
                _uiState.value = ExploreUiState.Error(exception.message ?: "Search failed")
            }
        }
    }
}
