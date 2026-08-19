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
    data class Success(val reels: List<Reel>) : ReelsUiState()
    data class Error(val message: String) : ReelsUiState()
}

class ReelsViewModel : ViewModel() {
    // We might need a ReelRepository, but for now we'll use a placeholder or check if PostRepository can handle it
    // Backend social Router has GET /reels

    private val _uiState = MutableStateFlow<ReelsUiState>(ReelsUiState.Loading)
    val uiState: StateFlow<ReelsUiState> = _uiState.asStateFlow()

    init {
        loadReels()
    }

    fun loadReels() {
        // Placeholder for now
        _uiState.value = ReelsUiState.Success(emptyList())
    }
}
