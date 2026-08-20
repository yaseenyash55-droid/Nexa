package com.nexa.social

import com.nexa.social.data.models.Post
import com.nexa.social.data.models.Reel
import com.nexa.social.data.models.User
import com.nexa.social.data.repository.PostRepository
import com.nexa.social.data.repository.UserRepository
import com.nexa.social.ui.ChatActivity
import com.nexa.social.ui.RegisterActivity
import com.nexa.social.ui.viewmodels.ExploreUiState
import com.nexa.social.ui.viewmodels.ExploreViewModel
import com.nexa.social.ui.viewmodels.HomeUiState
import com.nexa.social.ui.viewmodels.HomeViewModel
import com.nexa.social.ui.viewmodels.ProfileUiState
import com.nexa.social.ui.viewmodels.ProfileViewModel
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
import org.junit.Assert.assertFalse
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

        `when`(mockRepo.getFeed(limit = 20, offset = 0)).thenReturn(Result.success(listOf(dummyPost)))
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
    fun `home viewmodel rolls back like on API failure`() = runTest {
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

        `when`(mockRepo.getFeed(limit = 20, offset = 0)).thenReturn(Result.success(listOf(dummyPost)))
        `when`(mockRepo.likePost(101)).thenReturn(Result.failure(Exception("Network error")))

        val viewModel = HomeViewModel(mockRepo)
        advanceUntilIdle()

        viewModel.toggleLike(dummyPost)
        advanceUntilIdle()

        // Should roll back to unliked
        val finalState = viewModel.uiState.value as HomeUiState.Success
        assertEquals(false, finalState.posts[0].isLiked)
        assertEquals(5, finalState.posts[0].likesCount)
    }

    @Test
    fun `home viewmodel rolls back bookmark on API failure`() = runTest {
        val mockRepo = mock(PostRepository::class.java)
        val dummyAuthor = User(userId = 1, username = "alice", email = "alice@example.com", displayName = "Alice")
        val dummyPost = Post(
            postId = 101,
            userId = 1,
            author = dummyAuthor,
            content = "Bookmark test",
            imageUrl = null,
            createdAt = "2026-01-01T00:00:00.000Z",
            likesCount = 2,
            commentsCount = 0,
            isLiked = false,
            isBookmarked = false
        )

        `when`(mockRepo.getFeed(limit = 20, offset = 0)).thenReturn(Result.success(listOf(dummyPost)))
        `when`(mockRepo.bookmarkPost(101)).thenReturn(Result.failure(Exception("Bookmark failed")))

        val viewModel = HomeViewModel(mockRepo)
        advanceUntilIdle()

        viewModel.toggleBookmark(dummyPost)
        advanceUntilIdle()

        val finalState = viewModel.uiState.value as HomeUiState.Success
        assertEquals(false, finalState.posts[0].isBookmarked)
    }

    @Test
    fun `home viewmodel transitions to empty state when feed is empty`() = runTest {
        val mockRepo = mock(PostRepository::class.java)
        `when`(mockRepo.getFeed(limit = 20, offset = 0)).thenReturn(Result.success(emptyList()))

        val viewModel = HomeViewModel(mockRepo)
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value is HomeUiState.Empty)
    }

    @Test
    fun `home viewmodel transitions to error state on network error`() = runTest {
        val mockRepo = mock(PostRepository::class.java)
        `when`(mockRepo.getFeed(limit = 20, offset = 0)).thenReturn(Result.failure(Exception("Connection refused")))

        val viewModel = HomeViewModel(mockRepo)
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value is HomeUiState.Error)
        assertEquals("Connection refused", (viewModel.uiState.value as HomeUiState.Error).message)
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

        `when`(mockRepo.getReels(limit = 20, offset = 0)).thenReturn(Result.success(listOf(dummyReel)))
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

    @Test
    fun `reels viewmodel rolls back like on failure`() = runTest {
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

        `when`(mockRepo.getReels(limit = 20, offset = 0)).thenReturn(Result.success(listOf(dummyReel)))
        `when`(mockRepo.likeReel(501)).thenReturn(Result.failure(Exception("Reel like failed")))

        val viewModel = ReelsViewModel(mockRepo)
        advanceUntilIdle()

        viewModel.toggleLike(dummyReel)
        advanceUntilIdle()

        val state = viewModel.uiState.value as ReelsUiState.Success
        assertEquals(false, state.reels[0].isLiked)
        assertEquals(10, state.reels[0].likesCount)
    }

    @Test
    fun `explore viewmodel performs search and updates state`() = runTest {
        val mockRepo = mock(UserRepository::class.java)
        val user1 = User(userId = 10, username = "dev_dan", displayName = "Dan Developer", email = "dan@example.com")

        `when`(mockRepo.searchUsers("dan")).thenReturn(Result.success(listOf(user1)))

        val viewModel = ExploreViewModel(mockRepo)
        advanceUntilIdle()
        assertTrue(viewModel.uiState.value is ExploreUiState.Idle)

        viewModel.search("dan")
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value is ExploreUiState.Success)
        val success = viewModel.uiState.value as ExploreUiState.Success
        assertEquals(1, success.users.size)
        assertEquals("dev_dan", success.users[0].username)
    }

    @Test
    fun `explore viewmodel handles search failure`() = runTest {
        val mockRepo = mock(UserRepository::class.java)
        `when`(mockRepo.searchUsers("error_query")).thenReturn(Result.failure(Exception("Search timeout")))

        val viewModel = ExploreViewModel(mockRepo)
        viewModel.search("error_query")
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value is ExploreUiState.Error)
        assertEquals("Search timeout", (viewModel.uiState.value as ExploreUiState.Error).message)
    }

    @Test
    fun `profile viewmodel loads profile and handles local updates`() = runTest {
        val mockRepo = mock(UserRepository::class.java)
        val initialUser = User(
            userId = 5,
            username = "elena",
            displayName = "Elena Rostova",
            email = "elena@example.com",
            bio = "Nexa Architect",
            followersCount = 100,
            followingCount = 40
        )

        `when`(mockRepo.getProfile("elena")).thenReturn(Result.success(initialUser))

        val viewModel = ProfileViewModel(mockRepo)
        viewModel.loadProfile("elena")
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value is ProfileUiState.Success)
        val state = viewModel.uiState.value as ProfileUiState.Success
        assertEquals("Elena Rostova", state.user.displayName)

        // Local profile update
        val updatedUser = initialUser.copy(displayName = "Elena R.", bio = "Senior Architect")
        viewModel.updateProfileLocally(updatedUser)
        advanceUntilIdle()

        val updatedState = viewModel.uiState.value as ProfileUiState.Success
        assertEquals("Elena R.", updatedState.user.displayName)
        assertEquals("Senior Architect", updatedState.user.bio)
    }

    @Test
    fun `registration input validation rejects blank username and invalid fields`() {
        fun validateRegister(username: String, email: String, pass: String): String? {
            if (username.isBlank() || username.length < 3) return "Username must be at least 3 characters"
            if (!email.contains("@") || !email.contains(".")) return "Enter a valid email"
            if (pass.length < 8) return "Password must be at least 8 characters"
            return null
        }

        assertEquals("Username must be at least 3 characters", validateRegister("", "test@example.com", "pass12345"))
        assertEquals("Username must be at least 3 characters", validateRegister("ab", "test@example.com", "pass12345"))
        assertEquals("Enter a valid email", validateRegister("alice", "invalid-email", "pass12345"))
        assertEquals("Password must be at least 8 characters", validateRegister("alice", "alice@example.com", "short"))
        assertEquals(null, validateRegister("alice", "alice@example.com", "password123"))
    }
}
