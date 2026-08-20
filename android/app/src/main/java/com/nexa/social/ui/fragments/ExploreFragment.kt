package com.nexa.social.ui.fragments

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.nexa.social.R
import com.nexa.social.databinding.FragmentExploreBinding
import com.nexa.social.ui.adapters.UserAdapter
import com.nexa.social.ui.viewmodels.ExploreUiState
import com.nexa.social.ui.viewmodels.ExploreViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class ExploreFragment : Fragment() {
    private var _binding: FragmentExploreBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ExploreViewModel by viewModels()
    private lateinit var userAdapter: UserAdapter
    private var searchJob: Job? = null

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
            val bundle = Bundle().apply {
                putString("username", user.username)
            }
            try {
                findNavController().navigate(R.id.navigation_profile, bundle)
            } catch (_: Exception) {}
        }
        binding.rvResults.adapter = userAdapter
    }

    private fun setupSearch() {
        binding.etSearch.setOnEditorActionListener { v, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                searchJob?.cancel()
                viewModel.search(v.text.toString())
                true
            } else {
                false
            }
        }

        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                searchJob?.cancel()
                val query = s?.toString()?.trim() ?: ""
                searchJob = viewLifecycleOwner.lifecycleScope.launch {
                    delay(300) // 300ms debounce
                    viewModel.search(query)
                }
            }
            override fun afterTextChanged(s: Editable?) {}
        })
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
        searchJob?.cancel()
        _binding = null
    }
}
