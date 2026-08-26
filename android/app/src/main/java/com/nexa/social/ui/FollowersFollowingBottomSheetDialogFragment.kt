package com.nexa.social.ui

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.tabs.TabLayout
import com.nexa.social.MainActivity
import com.nexa.social.R
import com.nexa.social.data.models.User
import com.nexa.social.data.repository.UserRepository
import com.nexa.social.ui.adapters.UserConnectionAdapter
import com.nexa.social.utils.PreferenceManager
import kotlinx.coroutines.launch

class FollowersFollowingBottomSheetDialogFragment : BottomSheetDialogFragment() {

    private var targetUserId: Int = 0
    private var targetUsername: String = ""
    private var isOwner: Boolean = false
    private var activeTab: String = "followers"

    private lateinit var tabLayout: TabLayout
    private lateinit var etSearch: EditText
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var rvConnections: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var layoutEmpty: LinearLayout
    private lateinit var tvEmptyTitle: TextView
    private lateinit var tvEmptySubtitle: TextView
    private lateinit var tvHeaderUsername: TextView

    private lateinit var prefManager: PreferenceManager
    private val userRepository = UserRepository()

    private var followersList = listOf<User>()
    private var followingList = listOf<User>()
    private var searchQuery: String = ""

    private lateinit var adapter: UserConnectionAdapter

    companion object {
        private const val ARG_USER_ID = "target_user_id"
        private const val ARG_USERNAME = "target_username"
        private const val ARG_INITIAL_TAB = "initial_tab"

        fun newInstance(userId: Int, username: String, initialTab: String = "followers"): FollowersFollowingBottomSheetDialogFragment {
            return FollowersFollowingBottomSheetDialogFragment().apply {
                arguments = Bundle().apply {
                    putInt(ARG_USER_ID, userId)
                    putString(ARG_USERNAME, username)
                    putString(ARG_INITIAL_TAB, initialTab)
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        targetUserId = arguments?.getInt(ARG_USER_ID) ?: 0
        targetUsername = arguments?.getString(ARG_USERNAME) ?: ""
        activeTab = arguments?.getString(ARG_INITIAL_TAB) ?: "followers"
        prefManager = PreferenceManager(requireContext())
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.dialog_followers_following, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        tvHeaderUsername = view.findViewById(R.id.tvHeaderUsername)
        val btnClose = view.findViewById<ImageButton>(R.id.btnCloseDialog)
        tabLayout = view.findViewById(R.id.tabLayoutConnections)
        etSearch = view.findViewById(R.id.etSearchConnections)
        swipeRefresh = view.findViewById(R.id.swipeRefreshConnections)
        rvConnections = view.findViewById(R.id.rvConnections)
        progressBar = view.findViewById(R.id.progressBarConnections)
        layoutEmpty = view.findViewById(R.id.layoutEmptyConnections)
        tvEmptyTitle = view.findViewById(R.id.tvEmptyTitle)
        tvEmptySubtitle = view.findViewById(R.id.tvEmptySubtitle)

        tvHeaderUsername.text = "@$targetUsername"
        btnClose.setOnClickListener { dismiss() }

        isOwner = targetUserId == prefManager.userId || targetUsername == prefManager.username

        adapter = UserConnectionAdapter(
            currentUserId = prefManager.userId,
            isOwnerProfile = isOwner,
            activeTab = activeTab,
            onUserClick = { user ->
                dismiss()
                if (user.username != targetUsername) {
                    val intent = Intent(requireContext(), MainActivity::class.java).apply {
                        putExtra("open_profile_username", user.username)
                    }
                    startActivity(intent)
                }
            },
            onMessageClick = { user ->
                dismiss()
                val intent = Intent(requireContext(), ChatActivity::class.java).apply {
                    putExtra(ChatActivity.EXTRA_CHAT_TYPE, "direct")
                    putExtra(ChatActivity.EXTRA_TARGET_ID, user.userId)
                    putExtra(ChatActivity.EXTRA_TARGET_NAME, user.displayName.ifEmpty { user.username })
                }
                startActivity(intent)
            },
            onFollowToggle = { user, isCurrentlyFollowing ->
                handleFollowToggle(user, isCurrentlyFollowing)
            },
            onRemoveFollowerClick = { user ->
                confirmRemoveFollower(user)
            }
        )

        rvConnections.layoutManager = LinearLayoutManager(requireContext())
        rvConnections.adapter = adapter

        setupTabs()

        swipeRefresh.setOnRefreshListener {
            loadData()
        }

        etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                searchQuery = s?.toString()?.trim() ?: ""
                filterAndDisplayList()
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        loadData()
    }

    private fun setupTabs() {
        tabLayout.removeAllTabs()
        val followersTab = tabLayout.newTab().setText("Followers")
        val followingTab = tabLayout.newTab().setText("Following")

        tabLayout.addTab(followersTab)
        tabLayout.addTab(followingTab)

        if (activeTab == "following") {
            followingTab.select()
        } else {
            followersTab.select()
        }

        tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                activeTab = if (tab?.position == 1) "following" else "followers"
                filterAndDisplayList()
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
    }

    private fun loadData() {
        progressBar.visibility = View.VISIBLE
        layoutEmpty.visibility = View.GONE

        lifecycleScope.launch {
            try {
                val followersResult = userRepository.getFollowers(targetUserId)
                val followingResult = userRepository.getFollowing(targetUserId)

                followersList = followersResult.getOrDefault(emptyList())
                followingList = followingResult.getOrDefault(emptyList())

                tabLayout.getTabAt(0)?.text = "Followers (${followersList.size})"
                tabLayout.getTabAt(1)?.text = "Following (${followingList.size})"

                filterAndDisplayList()
            } catch (e: Exception) {
                Toast.makeText(requireContext(), "Failed to load connections: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
            }
        }
    }

    private fun filterAndDisplayList() {
        val rawList = if (activeTab == "followers") followersList else followingList

        val filtered = if (searchQuery.isEmpty()) {
            rawList
        } else {
            val q = searchQuery.lowercase()
            rawList.filter {
                it.username.lowercase().contains(q) ||
                it.displayName.lowercase().contains(q) ||
                (it.bio?.lowercase()?.contains(q) == true)
            }
        }

        adapter.submitList(filtered, activeTab)

        if (filtered.isEmpty()) {
            layoutEmpty.visibility = View.VISIBLE
            if (searchQuery.isNotEmpty()) {
                tvEmptyTitle.text = "No results found"
                tvEmptySubtitle.text = "No users found matching '$searchQuery'"
            } else {
                if (activeTab == "followers") {
                    tvEmptyTitle.text = "No followers yet"
                    tvEmptySubtitle.text = "When people follow @$targetUsername, they will appear here."
                } else {
                    tvEmptyTitle.text = "Not following anyone"
                    tvEmptySubtitle.text = "@$targetUsername isn't following anyone yet."
                }
            }
        } else {
            layoutEmpty.visibility = View.GONE
        }
    }

    private fun handleFollowToggle(user: User, isCurrentlyFollowing: Boolean) {
        val newFollowState = !isCurrentlyFollowing
        adapter.updateUserFollowState(user.userId, newFollowState)

        lifecycleScope.launch {
            val result = if (isCurrentlyFollowing) {
                userRepository.unfollowUser(user.userId)
            } else {
                userRepository.followUser(user.userId)
            }

            result.onFailure {
                adapter.updateUserFollowState(user.userId, isCurrentlyFollowing)
                Toast.makeText(requireContext(), "Action failed: ${it.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun confirmRemoveFollower(user: User) {
        AlertDialog.Builder(requireContext())
            .setTitle("Remove Follower")
            .setMessage("Remove @${user.username} from your followers? They will not be notified.")
            .setPositiveButton("Remove") { _, _ ->
                lifecycleScope.launch {
                    val res = userRepository.removeFollower(targetUserId, user.userId)
                    res.onSuccess {
                        followersList = followersList.filter { it.userId != user.userId }
                        tabLayout.getTabAt(0)?.text = "Followers (${followersList.size})"
                        adapter.removeUser(user.userId)
                        if (followersList.isEmpty()) {
                            layoutEmpty.visibility = View.VISIBLE
                        }
                        Toast.makeText(requireContext(), "Follower removed", Toast.LENGTH_SHORT).show()
                    }.onFailure {
                        Toast.makeText(requireContext(), "Failed to remove follower: ${it.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
