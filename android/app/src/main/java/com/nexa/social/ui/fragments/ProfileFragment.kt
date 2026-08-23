package com.nexa.social.ui.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import coil.load
import coil.transform.CircleCropTransformation
import com.nexa.social.NexaApiClient
import com.nexa.social.R
import com.nexa.social.data.models.User
import com.nexa.social.databinding.FragmentProfileBinding
import com.nexa.social.ui.viewmodels.ProfileUiState
import com.nexa.social.ui.viewmodels.ProfileViewModel
import com.nexa.social.utils.PreferenceManager
import kotlinx.coroutines.launch

import android.content.Intent
import com.nexa.social.data.repository.AuthRepository
import com.nexa.social.data.repository.PostRepository
import com.nexa.social.ui.ChatActivity
import com.nexa.social.ui.CommentsBottomSheetDialogFragment
import com.nexa.social.ui.EditProfileBottomSheetDialogFragment
import com.nexa.social.ui.LoginActivity
import com.nexa.social.ui.adapters.PostAdapter
import com.nexa.social.utils.TokenManager

class ProfileFragment : Fragment() {
    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ProfileViewModel by viewModels()
    private lateinit var prefManager: PreferenceManager
    private val postRepository = PostRepository()
    private lateinit var postAdapter: PostAdapter
    private var isFollowing = false

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        prefManager = PreferenceManager(requireContext())
        setupRecyclerView()
        setupLogoutButton()
        observeViewModel()

        val username = arguments?.getString("username") ?: prefManager.username
        if (!username.isNullOrEmpty()) {
            viewModel.loadProfile(username)
        }
    }

    private fun setupRecyclerView() {
        postAdapter = PostAdapter(
            onLikeClick = { post ->
                lifecycleScope.launch {
                    if (post.isLiked) postRepository.unlikePost(post.postId)
                    else postRepository.likePost(post.postId)
                }
            },
            onCommentClick = { post ->
                CommentsBottomSheetDialogFragment.newInstance(post.postId).show(childFragmentManager, "comments")
            },
            onBookmarkClick = { post ->
                lifecycleScope.launch {
                    if (post.isBookmarked) postRepository.unbookmarkPost(post.postId)
                    else postRepository.bookmarkPost(post.postId)
                }
            }
        )
        binding.rvUserPosts.adapter = postAdapter
    }

    private fun setupLogoutButton() {
        binding.btnLogout.setOnClickListener {
            androidx.appcompat.app.AlertDialog.Builder(requireContext())
                .setTitle("Account Settings & Logout")
                .setMessage("Are you sure you want to log out of Nexa Social on this device?")
                .setPositiveButton("Log Out") { _, _ ->
                    lifecycleScope.launch {
                        try {
                            val tm = TokenManager(requireContext())
                            AuthRepository(tm).logout()
                        } catch (_: Exception) {}
                        val intent = Intent(requireContext(), LoginActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                        }
                        startActivity(intent)
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is ProfileUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                    }
                    is ProfileUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        bindProfile(state.user)
                    }
                    is ProfileUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                    }
                }
            }
        }
    }

    private fun bindProfile(user: User) {
        binding.tvDisplayName.text = user.displayName
        binding.tvUsername.text = "@${user.username}"
        binding.tvBio.text = user.bio ?: ""
        binding.tvFollowersCount.text = user.followersCount.toString()
        binding.tvFollowingCount.text = user.followingCount.toString()

        val avatarUrl = user.profileImageUrl?.let {
            if (it.startsWith("http")) it else "${NexaApiClient.BASE_URL.removeSuffix("api/")}${it.removePrefix("/")}"
        }
        binding.ivAvatar.load(avatarUrl) {
            crossfade(true)
            placeholder(R.drawable.ic_profile)
            error(R.drawable.ic_profile)
            transformations(CircleCropTransformation())
        }

        user.coverImageUrl?.let {
            val coverUrl = if (it.startsWith("http")) it else "${NexaApiClient.BASE_URL.removeSuffix("api/")}${it.removePrefix("/")}"
            binding.ivCover.load(coverUrl) {
                crossfade(true)
            }
        }

        val isOwner = user.userId == prefManager.userId || user.username == prefManager.username
        if (isOwner) {
            binding.btnEditProfile.visibility = View.VISIBLE
            binding.btnFollow.visibility = View.GONE
            binding.btnMessage.visibility = View.GONE
            binding.btnEditProfile.setOnClickListener {
                EditProfileBottomSheetDialogFragment.newInstance(user) { updatedUser ->
                    viewModel.updateProfileLocally(updatedUser)
                }.show(childFragmentManager, "edit_profile")
            }
        } else {
            binding.btnEditProfile.visibility = View.GONE
            binding.btnFollow.visibility = View.VISIBLE
            binding.btnMessage.visibility = View.VISIBLE
            binding.btnFollow.text = if (isFollowing) "Following" else "Follow"
            binding.btnFollow.setOnClickListener {
                isFollowing = !isFollowing
                binding.btnFollow.text = if (isFollowing) "Following" else "Follow"
                viewModel.toggleFollow(user, !isFollowing)
            }
            binding.btnMessage.setOnClickListener {
                val intent = Intent(requireContext(), ChatActivity::class.java).apply {
                    putExtra(ChatActivity.EXTRA_CHAT_TYPE, "direct")
                    putExtra(ChatActivity.EXTRA_TARGET_ID, user.userId)
                    putExtra(ChatActivity.EXTRA_TARGET_NAME, user.displayName)
                }
                startActivity(intent)
            }
        }

        // Load posts for user
        lifecycleScope.launch {
            postRepository.getFeed().onSuccess { allPosts ->
                val userPosts = allPosts.filter { it.userId == user.userId || it.author.userId == user.userId }
                postAdapter.submitList(userPosts)
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
