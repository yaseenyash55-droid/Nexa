package com.nexa.social.ui.fragments

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.nexa.social.databinding.FragmentExploreBinding
import com.nexa.social.ui.adapters.UserAdapter
import com.nexa.social.ui.viewmodels.ExploreUiState
import com.nexa.social.ui.viewmodels.ExploreViewModel
import kotlinx.coroutines.launch

class ExploreFragment : Fragment() {
    private var _binding: FragmentExploreBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ExploreViewModel by viewModels()
    private lateinit var userAdapter: UserAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentExploreBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupSearch()
        observeViewModel()
    }

    private fun setupRecyclerView() {
        userAdapter = UserAdapter { user ->
            // Navigate to profile
            // val intent = Intent(context, ProfileActivity::class.java)...
        }
        binding.rvResults.adapter = userAdapter
    }

    private fun setupSearch() {
        binding.etSearch.setOnEditorActionListener { v, actionId, event ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                viewModel.search(v.text.toString())
                true
            } else {
                false
            }
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is ExploreUiState.Idle -> {
                        binding.progressBar.visibility = View.GONE
                        userAdapter.submitList(emptyList())
                    }
                    is ExploreUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                    }
                    is ExploreUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        userAdapter.submitList(state.users)
                    }
                    is ExploreUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                    }
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
