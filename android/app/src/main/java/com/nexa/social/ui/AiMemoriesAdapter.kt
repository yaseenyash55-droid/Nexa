package com.nexa.social.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.nexa.social.R
import com.nexa.social.data.models.AiMemory

class AiMemoriesAdapter(
    private val onDeleteClicked: (AiMemory) -> Unit
) : ListAdapter<AiMemory, AiMemoriesAdapter.MemoryViewHolder>(AiMemoryDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MemoryViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_ai_memory, parent, false)
        return MemoryViewHolder(view)
    }

    override fun onBindViewHolder(holder: MemoryViewHolder, position: Int) {
        val item = getItem(position)
        holder.bind(item)
    }

    inner class MemoryViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvKey: TextView = itemView.findViewById(R.id.tvMemoryKey)
        private val tvCategory: TextView = itemView.findViewById(R.id.tvMemoryCategory)
        private val tvContent: TextView = itemView.findViewById(R.id.tvMemoryContent)
        private val btnDelete: ImageButton = itemView.findViewById(R.id.btnDeleteMemory)

        fun bind(memory: AiMemory) {
            tvKey.text = memory.keyName
            tvCategory.text = memory.category
            tvContent.text = memory.content

            btnDelete.setOnClickListener {
                onDeleteClicked(memory)
            }
        }
    }

    private class AiMemoryDiffCallback : DiffUtil.ItemCallback<AiMemory>() {
        override fun areItemsTheSame(oldItem: AiMemory, newItem: AiMemory): Boolean {
            return oldItem.memoryId == newItem.memoryId
        }

        override fun areContentsTheSame(oldItem: AiMemory, newItem: AiMemory): Boolean {
            return oldItem == newItem
        }
    }
}
