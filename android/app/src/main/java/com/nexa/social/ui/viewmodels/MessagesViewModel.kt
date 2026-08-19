package com.nexa.social.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexa.social.data.models.Conversation
import com.nexa.social.data.repository.MessageRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class MessagesUiState {
    object Loading : MessagesUiState()
    data class Success(val conversations: List<Conversation>) : MessagesUiState()
    data class Error(val message: String) : MessagesUiState()
}

class MessagesViewModel(private val repository: MessageRepository = MessageRepository()) : ViewModel() {

    private val _uiState = MutableStateFlow<MessagesUiState>(MessagesUiState.Loading)
    val uiState: StateFlow<MessagesUiState> = _uiState.asStateFlow()

    init {
        loadConversations()
    }

    fun loadConversations() {
        viewModelScope.launch {
            _uiState.value = MessagesUiState.Loading
            repository.getConversations().onSuccess { conversations ->
                _uiState.value = MessagesUiState.Success(conversations)
            }.onFailure { exception ->
                _uiState.value = MessagesUiState.Error(exception.message ?: "Unknown error")
            }
        }
    }
}
