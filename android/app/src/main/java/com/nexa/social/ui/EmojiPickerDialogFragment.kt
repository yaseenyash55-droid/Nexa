package com.nexa.social.ui

import android.app.Dialog
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.ImageButton
import android.widget.TextView
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.nexa.social.R

class EmojiPickerDialogFragment(
    private val onEmojiSelected: (String) -> Unit
) : BottomSheetDialogFragment() {

    data class EmojiCategory(val name: String, val icon: String, val emojis: List<String>)

    private val categories = listOf(
        EmojiCategory("Smileys", "😀", listOf(
            "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
            "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙",
            "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔",
            "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥",
            "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮",
            "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓",
            "🧐", "😕", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "😦",
            "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓",
            "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀"
        )),
        EmojiCategory("Gestures", "👍", listOf(
            "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞",
            "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍",
            "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝",
            "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂"
        )),
        EmojiCategory("Hearts", "❤️", listOf(
            "❤️", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤", "🤍", "💔",
            "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💌",
            "💋", "💍", "💐", "🌹", "🥀", "🌺", "🌸", "🌼", "🌻", "✨"
        )),
        EmojiCategory("Animals", "🐶", listOf(
            "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
            "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆",
            "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋",
            "🐌", "🐞", "🐜", "🦟", "🦗", "🕷️", "🦂", "🐢", "🐍", "🦎"
        )),
        EmojiCategory("Food", "🍔", listOf(
            "🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐",
            "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑", "🥦",
            "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🫔", "🥙", "🧆",
            "🍜", "🍝", "🍣", "🍱", "🍛", "🍙", "🍚", "🥟", "🍤", "🎂"
        )),
        EmojiCategory("Activities", "⚽", listOf(
            "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱",
            "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳",
            "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷"
        )),
        EmojiCategory("Objects", "💡", listOf(
            "💡", "🔦", "🕯️", "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️",
            "🕹️", "💽", "💾", "💿", "📀", "📷", "📸", "📹", "🎥", "📽️",
            "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️", "🎚️", "🎛️", "⏱️"
        )),
        EmojiCategory("Symbols", "🔥", listOf(
            "🔥", "💥", "⚡", "🌟", "⭐", "🌈", "☀️", "🌙", "🪐", "🌌",
            "🚀", "🛸", "🛰️", "🌠", "💯", "✅", "✔️", "❌", "⭕", "🛑",
            "⛔", "⚠️", "🚨", "🚩", "🏁", "🎉", "🎊", "🎈", "🏆", "👑"
        ))
    )

    private var currentCategoryIndex = 0
    private var displayedEmojis = mutableListOf<String>()
    private lateinit var adapter: EmojiAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.dialog_emoji_picker, container, false)
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = super.onCreateDialog(savedInstanceState) as BottomSheetDialog
        dialog.setOnShowListener {
            val bottomSheet = dialog.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet)
            if (bottomSheet != null) {
                BottomSheetBehavior.from(bottomSheet).state = BottomSheetBehavior.STATE_EXPANDED
            }
        }
        return dialog
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val btnClose = view.findViewById<ImageButton>(R.id.btnCloseEmoji)
        val etSearch = view.findViewById<EditText>(R.id.etSearchEmoji)
        val chipGroup = view.findViewById<ChipGroup>(R.id.chipGroupEmojiCategories)
        val rvEmojis = view.findViewById<RecyclerView>(R.id.rvEmojis)

        btnClose.setOnClickListener { dismiss() }

        // Setup Chips
        categories.forEachIndexed { index, category ->
            val chip = Chip(requireContext()).apply {
                text = "${category.icon} ${category.name}"
                isCheckable = true
                isChecked = index == 0
                setChipBackgroundColorResource(if (index == 0) R.color.brand_indigo else android.R.color.transparent)
                setTextColor(android.graphics.Color.WHITE)
                setOnClickListener {
                    currentCategoryIndex = index
                    etSearch.setText("")
                    updateEmojiList(categories[index].emojis)
                }
            }
            chipGroup.addView(chip)
        }

        // Setup Recycler
        rvEmojis.layoutManager = GridLayoutManager(requireContext(), 7)
        adapter = EmojiAdapter(displayedEmojis) { emoji ->
            onEmojiSelected(emoji)
            dismiss()
        }
        rvEmojis.adapter = adapter

        updateEmojiList(categories[0].emojis)

        // Search Filter
        etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val query = s?.toString()?.trim() ?: ""
                if (query.isEmpty()) {
                    updateEmojiList(categories[currentCategoryIndex].emojis)
                } else {
                    val all = categories.flatMap { it.emojis }
                    updateEmojiList(all)
                }
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun updateEmojiList(emojis: List<String>) {
        displayedEmojis.clear()
        displayedEmojis.addAll(emojis)
        adapter.notifyDataSetChanged()
    }

    private class EmojiAdapter(
        private val emojis: List<String>,
        private val onClick: (String) -> Unit
    ) : RecyclerView.Adapter<EmojiAdapter.EmojiViewHolder>() {

        class EmojiViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvEmoji: TextView = view.findViewById(R.id.tvEmoji)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): EmojiViewHolder {
            val view = LayoutInflater.from(parent.context).inflate(R.layout.item_emoji, parent, false)
            return EmojiViewHolder(view)
        }

        override fun onBindViewHolder(holder: EmojiViewHolder, position: Int) {
            val emoji = emojis[position]
            holder.tvEmoji.text = emoji
            holder.itemView.setOnClickListener { onClick(emoji) }
        }

        override fun getItemCount(): Int = emojis.size
    }
}
