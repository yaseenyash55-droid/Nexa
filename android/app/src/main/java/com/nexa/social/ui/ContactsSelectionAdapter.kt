package com.nexa.social.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.nexa.social.R
import com.nexa.social.data.models.User

class ContactsSelectionAdapter : RecyclerView.Adapter<ContactsSelectionAdapter.ViewHolder>() {

    private val users = mutableListOf<User>()
    private val selectedUserIds = mutableSetOf<Int>()

    fun submitList(newUsers: List<User>) {
        users.clear()
        users.addAll(newUsers)
        notifyDataSetChanged()
    }

    fun getSelectedUserIds(): List<Int> {
        return selectedUserIds.toList()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_contact_selectable, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(users[position])
    }

    override fun getItemCount(): Int = users.size

    inner class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvName: TextView = itemView.findViewById(R.id.tvName)
        private val tvUsername: TextView = itemView.findViewById(R.id.tvUsername)
        private val cbSelect: CheckBox = itemView.findViewById(R.id.cbSelect)

        fun bind(user: User) {
            tvName.text = user.displayName
            tvUsername.text = "@${user.username}"
            cbSelect.setOnCheckedChangeListener(null)
            cbSelect.isChecked = selectedUserIds.contains(user.userId)

            cbSelect.setOnCheckedChangeListener { _, isChecked ->
                if (isChecked) {
                    selectedUserIds.add(user.userId)
                } else {
                    selectedUserIds.remove(user.userId)
                }
            }

            itemView.setOnClickListener {
                cbSelect.isChecked = !cbSelect.isChecked
            }
        }
    }
}
