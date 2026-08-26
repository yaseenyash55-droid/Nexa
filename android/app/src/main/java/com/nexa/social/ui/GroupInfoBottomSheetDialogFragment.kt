package com.nexa.social.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.widget.SwitchCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.button.MaterialButton
import com.nexa.social.R
import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.Group
import com.nexa.social.data.models.GroupMember
import com.nexa.social.data.models.User
import com.nexa.social.utils.PreferenceManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class GroupInfoBottomSheetDialogFragment : BottomSheetDialogFragment() {

    private var groupId: Int = 0
    private var groupName: String = ""
    private var isCurrentUserAdmin: Boolean = false
    private var currentGroup: Group? = null

    private lateinit var prefManager: PreferenceManager
    private val members = mutableListOf<GroupMember>()
    private lateinit var adapter: GroupMembersAdapter

    private var onGroupDeletedListener: (() -> Unit)? = null
    private var onGroupLeftListener: (() -> Unit)? = null
    private var onGroupUpdatedListener: ((Group) -> Unit)? = null

    companion object {
        private const val ARG_GROUP_ID = "group_id"
        private const val ARG_GROUP_NAME = "group_name"

        fun newInstance(
            groupId: Int,
            groupName: String,
            onUpdated: ((Group) -> Unit)? = null,
            onDeleted: (() -> Unit)? = null,
            onLeft: (() -> Unit)? = null
        ): GroupInfoBottomSheetDialogFragment {
            return GroupInfoBottomSheetDialogFragment().apply {
                arguments = Bundle().apply {
                    putInt(ARG_GROUP_ID, groupId)
                    putString(ARG_GROUP_NAME, groupName)
                }
                this.onGroupUpdatedListener = onUpdated
                this.onGroupDeletedListener = onDeleted
                this.onGroupLeftListener = onLeft
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        groupId = arguments?.getInt(ARG_GROUP_ID) ?: 0
        groupName = arguments?.getString(ARG_GROUP_NAME) ?: "Group"
        prefManager = PreferenceManager(requireContext())
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.dialog_group_info, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val tvGroupName = view.findViewById<TextView>(R.id.tvGroupName)
        val tvGroupDetails = view.findViewById<TextView>(R.id.tvGroupDetails)
        val ivGroupAvatar = view.findViewById<ImageView>(R.id.ivGroupAvatar)
        val btnClose = view.findViewById<View>(R.id.btnClose)
        val layoutAnnouncement = view.findViewById<LinearLayout>(R.id.layoutAnnouncementSetting)
        val switchAnnouncement = view.findViewById<SwitchCompat>(R.id.switchAnnouncementMode)
        val btnAddMember = view.findViewById<MaterialButton>(R.id.btnAddMember)
        val rvMembers = view.findViewById<RecyclerView>(R.id.rvMembers)
        val btnLeaveGroup = view.findViewById<MaterialButton>(R.id.btnLeaveGroup)
        val btnDeleteGroup = view.findViewById<MaterialButton>(R.id.btnDeleteGroup)
        val progressBar = view.findViewById<ProgressBar>(R.id.progressBar)

        tvGroupName.text = groupName
        tvGroupDetails.text = "Loading group info..."

        adapter = GroupMembersAdapter(
            currentUserId = prefManager.userId,
            isCurrentUserAdmin = false,
            onRemoveClick = { member ->
                confirmRemoveMember(member)
            }
        )
        rvMembers.layoutManager = LinearLayoutManager(requireContext())
        rvMembers.adapter = adapter

        btnClose.setOnClickListener { dismiss() }

        switchAnnouncement.setOnCheckedChangeListener { _, isChecked ->
            if (isCurrentUserAdmin && currentGroup != null && currentGroup?.onlyAdminsCanPost != isChecked) {
                updateAnnouncementMode(isChecked)
            }
        }

        btnAddMember.setOnClickListener {
            showAddMemberDialog()
        }

        btnLeaveGroup.setOnClickListener {
            confirmLeaveGroup()
        }

        btnDeleteGroup.setOnClickListener {
            confirmDeleteGroup()
        }

        loadGroupData(progressBar, tvGroupDetails, switchAnnouncement, btnAddMember, btnDeleteGroup, layoutAnnouncement)
    }

    private fun loadGroupData(
        progressBar: ProgressBar,
        tvGroupDetails: TextView,
        switchAnnouncement: SwitchCompat,
        btnAddMember: MaterialButton,
        btnDeleteGroup: MaterialButton,
        layoutAnnouncement: LinearLayout
    ) {
        progressBar.visibility = View.VISIBLE
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val groupResp = NexaApiClient.groupApi.getGroupById(groupId)
                val membersResp = NexaApiClient.groupApi.getGroupMembers(groupId)

                withContext(Dispatchers.Main) {
                    progressBar.visibility = View.GONE
                    if (groupResp.isSuccessful && groupResp.body()?.data != null) {
                        currentGroup = groupResp.body()!!.data
                    }
                    if (membersResp.isSuccessful && membersResp.body()?.data != null) {
                        members.clear()
                        members.addAll(membersResp.body()!!.data!!)
                    }

                    val myUserId = prefManager.userId
                    val myRole = members.find { it.userId == myUserId }?.role
                    val isCreator = currentGroup?.createdBy == myUserId
                    isCurrentUserAdmin = isCreator || myRole == "ADMIN"

                    val group = currentGroup
                    if (group != null) {
                        tvGroupDetails.text = "${members.size} members" + if (!group.description.isNullOrBlank()) " • ${group.description}" else ""
                        switchAnnouncement.isChecked = group.onlyAdminsCanPost
                    }

                    switchAnnouncement.isEnabled = isCurrentUserAdmin
                    layoutAnnouncement.visibility = View.VISIBLE
                    btnAddMember.visibility = if (isCurrentUserAdmin) View.VISIBLE else View.GONE
                    btnDeleteGroup.visibility = if (isCurrentUserAdmin) View.VISIBLE else View.GONE

                    adapter.updateAdminStatus(isCurrentUserAdmin)
                    adapter.submitList(members.toList())
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    progressBar.visibility = View.GONE
                    Toast.makeText(context, "Error loading group: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun updateAnnouncementMode(onlyAdminsCanPost: Boolean) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val resp = NexaApiClient.groupApi.updateGroupSettings(
                    groupId,
                    mapOf("onlyAdminsCanPost" to onlyAdminsCanPost)
                )
                withContext(Dispatchers.Main) {
                    if (resp.isSuccessful && resp.body()?.data != null) {
                        currentGroup = resp.body()!!.data
                        onGroupUpdatedListener?.invoke(currentGroup!!)
                        Toast.makeText(
                            context,
                            if (onlyAdminsCanPost) "Announcement mode enabled (Admins only)" else "Announcement mode disabled (All members)",
                            Toast.LENGTH_SHORT
                        ).show()
                    } else {
                        Toast.makeText(context, "Failed to update group setting", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Error updating setting: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun showAddMemberDialog() {
        val input = EditText(requireContext()).apply {
            hint = "Search username to add..."
            setPadding(40, 30, 40, 30)
            setTextColor(0xFFFFFFFF.toInt())
            setHintTextColor(0xFF64748B.toInt())
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Add Member to Group")
            .setView(input)
            .setPositiveButton("Search & Add") { _, _ ->
                val query = input.text.toString().trim()
                if (query.isNotBlank()) {
                    searchAndAddUser(query)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun searchAndAddUser(usernameQuery: String) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val searchResp = NexaApiClient.userApi.searchUsers(usernameQuery)
                if (searchResp.isSuccessful && !searchResp.body()?.data.isNullOrEmpty()) {
                    val matchingUsers = searchResp.body()!!.data!!
                    val candidate: User = matchingUsers.firstOrNull {
                        it.username.equals(usernameQuery, ignoreCase = true) ||
                        it.username.contains(usernameQuery, ignoreCase = true)
                    } ?: matchingUsers.first()

                    val addResp = NexaApiClient.groupApi.addGroupMembers(
                        groupId,
                        mapOf("members" to listOf(candidate.userId))
                    )
                    withContext(Dispatchers.Main) {
                        if (addResp.isSuccessful) {
                            Toast.makeText(context, "Added @${candidate.username} to group", Toast.LENGTH_SHORT).show()
                            loadGroupData(
                                view?.findViewById(R.id.progressBar) ?: return@withContext,
                                view?.findViewById(R.id.tvGroupDetails) ?: return@withContext,
                                view?.findViewById(R.id.switchAnnouncementMode) ?: return@withContext,
                                view?.findViewById(R.id.btnAddMember) ?: return@withContext,
                                view?.findViewById(R.id.btnDeleteGroup) ?: return@withContext,
                                view?.findViewById(R.id.layoutAnnouncementSetting) ?: return@withContext
                            )
                        } else {
                            Toast.makeText(context, "Could not add user to group", Toast.LENGTH_SHORT).show()
                        }
                    }
                } else {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(context, "No user found with username: $usernameQuery", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun confirmRemoveMember(member: GroupMember) {
        val name = member.user?.displayName ?: member.user?.username ?: "this member"
        AlertDialog.Builder(requireContext())
            .setTitle("Remove Member")
            .setMessage("Are you sure you want to remove $name from the group?")
            .setPositiveButton("Remove") { _, _ ->
                removeMember(member.userId)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun removeMember(userId: Int) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val resp = NexaApiClient.groupApi.removeGroupMember(groupId, userId)
                withContext(Dispatchers.Main) {
                    if (resp.isSuccessful) {
                        Toast.makeText(context, "Member removed", Toast.LENGTH_SHORT).show()
                        members.removeAll { it.userId == userId }
                        adapter.submitList(members.toList())
                    } else {
                        Toast.makeText(context, "Failed to remove member", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun confirmLeaveGroup() {
        AlertDialog.Builder(requireContext())
            .setTitle("Leave Group")
            .setMessage("Are you sure you want to leave this group?")
            .setPositiveButton("Leave") { _, _ ->
                leaveGroup()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun leaveGroup() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val resp = NexaApiClient.groupApi.leaveGroup(groupId)
                withContext(Dispatchers.Main) {
                    if (resp.isSuccessful) {
                        Toast.makeText(context, "You left the group", Toast.LENGTH_SHORT).show()
                        dismiss()
                        onGroupLeftListener?.invoke()
                    } else {
                        Toast.makeText(context, "Failed to leave group", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun confirmDeleteGroup() {
        AlertDialog.Builder(requireContext())
            .setTitle("Delete Group")
            .setMessage("Are you sure you want to delete this group? This action is permanent and cannot be undone.")
            .setPositiveButton("Delete Forever") { _, _ ->
                deleteGroup()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun deleteGroup() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val resp = NexaApiClient.groupApi.deleteGroup(groupId)
                withContext(Dispatchers.Main) {
                    if (resp.isSuccessful) {
                        Toast.makeText(context, "Group deleted", Toast.LENGTH_SHORT).show()
                        dismiss()
                        onGroupDeletedListener?.invoke()
                    } else {
                        Toast.makeText(context, "Failed to delete group", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    class GroupMembersAdapter(
        private val currentUserId: Int,
        private var isCurrentUserAdmin: Boolean,
        private val onRemoveClick: (GroupMember) -> Unit
    ) : RecyclerView.Adapter<GroupMembersAdapter.ViewHolder>() {

        private var items = listOf<GroupMember>()

        fun submitList(newList: List<GroupMember>) {
            items = newList
            notifyDataSetChanged()
        }

        fun updateAdminStatus(isAdmin: Boolean) {
            isCurrentUserAdmin = isAdmin
            notifyDataSetChanged()
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context).inflate(R.layout.item_group_member, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            holder.bind(items[position])
        }

        override fun getItemCount() = items.size

        inner class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
            private val ivAvatar = itemView.findViewById<ImageView>(R.id.ivAvatar)
            private val tvDisplayName = itemView.findViewById<TextView>(R.id.tvDisplayName)
            private val tvUsername = itemView.findViewById<TextView>(R.id.tvUsername)
            private val tvAdminBadge = itemView.findViewById<TextView>(R.id.tvAdminBadge)
            private val btnRemove = itemView.findViewById<MaterialButton>(R.id.btnRemoveMember)

            fun bind(member: GroupMember) {
                val user = member.user
                val displayName = user?.displayName ?: "User #${member.userId}"
                val username = user?.username ?: "user_${member.userId}"
                val isSelf = member.userId == currentUserId
                val isMemberAdmin = member.role == "ADMIN"

                tvDisplayName.text = if (isSelf) "$displayName (You)" else displayName
                tvUsername.text = "@$username"
                tvAdminBadge.visibility = if (isMemberAdmin) View.VISIBLE else View.GONE

                // Admin can remove other non-admin or regular members, but not himself through this button
                val canRemove = isCurrentUserAdmin && !isSelf
                btnRemove.visibility = if (canRemove) View.VISIBLE else View.GONE
                btnRemove.setOnClickListener {
                    onRemoveClick(member)
                }

                if (!user?.profileImageUrl.isNullOrBlank()) {
                    ivAvatar.load(user!!.profileImageUrl) {
                        crossfade(true)
                        transformations(CircleCropTransformation())
                    }
                } else {
                    ivAvatar.setImageResource(R.drawable.ic_profile)
                }
            }
        }
    }
}
