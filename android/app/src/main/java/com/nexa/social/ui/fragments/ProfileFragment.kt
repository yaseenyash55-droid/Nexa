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

class ProfileFragment : Fragment() {
    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ProfileViewModel by viewModels()
    private lateinit var prefManager: PreferenceManager

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        prefManager = PreferenceManager(requireContext())
        observeViewModel()

        val username = arguments?.getString("username") ?: prefManager.username
        if (!username.isNullOrEmpty()) {
            viewModel.loadProfile(username)
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
        binding.tvBio.text = user.bio
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

        binding.btnEditProfile.visibility = if (user.userId == prefManager.userId) View.VISIBLE else View.GONE
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
