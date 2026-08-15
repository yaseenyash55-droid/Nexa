package com.nexa.social.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.nexa.social.R
import com.nexa.social.data.models.Broadcast
import com.nexa.social.data.models.Group
import com.nexa.social.data.models.User

sealed class ConversationItem {
    data class Direct(val user: User) : ConversationItem()
    data class GroupChat(val group: Group) : ConversationItem()
    data class BroadcastList(val broadcast: Broadcast) : ConversationItem()
}

class ConversationsAdapter(
    private val onItemClick: (ConversationItem) -> Unit
) : RecyclerView.Adapter<ConversationsAdapter.ViewHolder>() {

    private val items = mutableListOf<ConversationItem>()

    fun submitList(newItems: List<ConversationItem>) {
        items.clear()
        items.addAll(newItems)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_conversation, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvName: TextView = itemView.findViewById(R.id.tvName)
        private val tvSubtitle: TextView = itemView.findViewById(R.id.tvSubtitle)
        private val tvBadge: TextView = itemView.findViewById(R.id.tvBadge)

        fun bind(item: ConversationItem) {
            when (item) {
                is ConversationItem.Direct -> {
                    tvName.text = item.user.displayName
                    tvSubtitle.text = "@${item.user.username}"
                    tvBadge.text = "E2EE 🔒"
                    tvBadge.visibility = View.VISIBLE
                }
                is ConversationItem.GroupChat -> {
                    tvName.text = item.group.name
                    tvSubtitle.text = "${item.group.membersCount} members • ${item.group.description ?: "Group conversation"}"
                    tvBadge.text = "GROUP"
                    tvBadge.visibility = View.VISIBLE
                }
                is ConversationItem.BroadcastList -> {
                    tvName.text = item.broadcast.title ?: "Broadcast List"
                    tvSubtitle.text = "${item.broadcast.recipientsCount} recipients • ${item.broadcast.content}"
                    tvBadge.text = "BROADCAST"
                    tvBadge.visibility = View.VISIBLE
                }
            }

            itemView.setOnClickListener {
                onItemClick(item)
            }
        }
    }
}
