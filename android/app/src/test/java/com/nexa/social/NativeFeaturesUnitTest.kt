package com.nexa.social

import com.nexa.social.data.models.Post
import com.nexa.social.data.models.Reel
import com.nexa.social.data.models.User
import com.nexa.social.data.repository.PostRepository
import com.nexa.social.ui.ChatActivity
import com.nexa.social.ui.viewmodels.HomeUiState
import com.nexa.social.ui.viewmodels.HomeViewModel
import com.nexa.social.ui.viewmodels.ReelsUiState
import com.nexa.social.ui.viewmodels.ReelsViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`

@OptIn(ExperimentalCoroutinesApi::class)
class NativeFeaturesUnitTest {

    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `chat intent constants follow strict contract`() {
        assertEquals("extra_chat_type", ChatActivity.EXTRA_CHAT_TYPE)
        assertEquals("extra_target_id", ChatActivity.EXTRA_TARGET_ID)
        assertEquals("extra_target_name", ChatActivity.EXTRA_TARGET_NAME)
    }

    @Test
    fun `home viewmodel toggles like optimistically and updates state flow`() = runTest {
        val mockRepo = mock(PostRepository::class.java)
        val dummyAuthor = User(userId = 1, username = "alice", email = "alice@example.com", displayName = "Alice")
        val dummyPost = Post(
            postId = 101,
            userId = 1,
            author = dummyAuthor,
            content = "Hello Nexa",
            imageUrl = null,
            createdAt = "2026-01-01T00:00:00.000Z",
            likesCount = 5,
            commentsCount = 2,
            isLiked = false,
            isBookmarked = false
        )

        `when`(mockRepo.getFeed()).thenReturn(Result.success(listOf(dummyPost)))
        `when`(mockRepo.likePost(101)).thenReturn(Result.success(Unit))

        val viewModel = HomeViewModel(mockRepo)
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value is HomeUiState.Success)
        val successState = viewModel.uiState.value as HomeUiState.Success
        assertEquals(1, successState.posts.size)
        assertEquals(false, successState.posts[0].isLiked)

        // Trigger optimistic like toggle
        viewModel.toggleLike(dummyPost)
        advanceUntilIdle()

        val afterLikeState = viewModel.uiState.value as HomeUiState.Success
        assertEquals(true, afterLikeState.posts[0].isLiked)
        assertEquals(6, afterLikeState.posts[0].likesCount)
    }

    @Test
    fun `reels viewmodel toggles reel like optimistically and updates state flow`() = runTest {
        val mockRepo = mock(PostRepository::class.java)
        val dummyAuthor = User(userId = 2, username = "bob", email = "bob@example.com", displayName = "Bob")
        val dummyReel = Reel(
            reelId = 501,
            userId = 2,
            author = dummyAuthor,
            videoUrl = "https://example.com/video.mp4",
            caption = "Amazing reel",
            likesCount = 10,
            isLiked = false,
            createdAt = "2026-01-01T00:00:00.000Z"
        )

        `when`(mockRepo.getReels()).thenReturn(Result.success(listOf(dummyReel)))
        `when`(mockRepo.likeReel(501)).thenReturn(Result.success(Unit))

        val viewModel = ReelsViewModel(mockRepo)
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value is ReelsUiState.Success)
        val state = viewModel.uiState.value as ReelsUiState.Success
        assertEquals(1, state.reels.size)

        // Trigger like
        viewModel.toggleLike(dummyReel)
        advanceUntilIdle()

        val afterLike = viewModel.uiState.value as ReelsUiState.Success
        assertEquals(true, afterLike.reels[0].isLiked)
        assertEquals(11, afterLike.reels[0].likesCount)
    }
}
