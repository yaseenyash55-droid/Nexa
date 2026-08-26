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
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.nexa.social.R

import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder

class GifPickerDialogFragment(
    private val onGifSelected: (String, String) -> Unit
) : BottomSheetDialogFragment() {

    data class GifItem(
        val id: String,
        val title: String,
        val url: String,
        val previewUrl: String,
        val category: String
    )

    private val giphyApiKey = "ydmYhvBQuhhugZWiAJhxItuZZ4PxbvA3"
    private val httpClient = OkHttpClient()
    private var searchJob: Job? = null

    private val curatedGifs = listOf(
        GifItem("laugh-1", "Laughing Out Loud", "https://media.giphy.com/media/26n6Gx9moCgs1qxxt/giphy.gif", "https://media.giphy.com/media/26n6Gx9moCgs1qxxt/200w.gif", "Reactions"),
        GifItem("mindblown-1", "Mind Blown", "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif", "https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.gif", "Reactions"),
        GifItem("applause-1", "Applause Ovation", "https://media.giphy.com/media/13GKP7xGjce5oI/giphy.gif", "https://media.giphy.com/media/13GKP7xGjce5oI/200w.gif", "Reactions"),
        GifItem("shrug-1", "Shrug Confused", "https://media.giphy.com/media/JRhS6WoswN8Fa/giphy.gif", "https://media.giphy.com/media/JRhS6WoswN8Fa/200w.gif", "Reactions"),
        GifItem("party-1", "Party Time Confetti", "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif", "https://media.giphy.com/media/artj92V8o75VPL7AeQ/200w.gif", "Celebration"),
        GifItem("dance-1", "Celebration Dance", "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif", "https://media.giphy.com/media/blSTtZehjAZ8I/200w.gif", "Celebration"),
        GifItem("rocket-1", "Rocket Hype", "https://media.giphy.com/media/mi6subQjyIS52/giphy.gif", "https://media.giphy.com/media/mi6subQjyIS52/200w.gif", "Hype"),
        GifItem("fire-1", "Fire Flame Hype", "https://media.giphy.com/media/nrXif9YExO9EI/giphy.gif", "https://media.giphy.com/media/nrXif9YExO9EI/200w.gif", "Hype"),
        GifItem("love-1", "Heart Floating Love", "https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif", "https://media.giphy.com/media/26BRv0ThflsHCqDrG/200w.gif", "Love"),
        GifItem("hug-1", "Warm Hug", "https://media.giphy.com/media/3bqtLDeiDtwhq/giphy.gif", "https://media.giphy.com/media/3bqtLDeiDtwhq/200w.gif", "Love"),
        GifItem("popcorn-1", "Eating Popcorn", "https://media.giphy.com/media/t3dLl0TGHCxTG/giphy.gif", "https://media.giphy.com/media/t3dLl0TGHCxTG/200w.gif", "Memes"),
        GifItem("gaming-1", "Gaming Victory", "https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif", "https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/200w.gif", "Gaming")
    )

    private val categories = listOf("All", "Reactions", "Celebration", "Hype", "Love", "Memes", "Gaming")
    private var currentCategory = "All"
    private var displayedGifs = mutableListOf<GifItem>()
    private lateinit var adapter: GifAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.dialog_gif_picker, container, false)
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

        val btnClose = view.findViewById<ImageButton>(R.id.btnCloseGif)
        val etSearch = view.findViewById<EditText>(R.id.etSearchGif)
        val chipGroup = view.findViewById<ChipGroup>(R.id.chipGroupGifCategories)
        val rvGifs = view.findViewById<RecyclerView>(R.id.rvGifs)

        btnClose.setOnClickListener { dismiss() }

        // Setup Categories
        categories.forEachIndexed { index, cat ->
            val chip = Chip(requireContext()).apply {
                text = cat
                isCheckable = true
                isChecked = index == 0
                setChipBackgroundColorResource(if (index == 0) R.color.brand_indigo else android.R.color.transparent)
                setTextColor(android.graphics.Color.WHITE)
                setOnClickListener {
                    currentCategory = cat
                    etSearch.setText("")
                    fetchGiphyGifs("")
                }
            }
            chipGroup.addView(chip)
        }

        // Setup Recycler
        rvGifs.layoutManager = GridLayoutManager(requireContext(), 2)
        adapter = GifAdapter(displayedGifs) { gif ->
            onGifSelected(gif.url, gif.title)
            dismiss()
        }
        rvGifs.adapter = adapter

        fetchGiphyGifs("")

        // Search Filter
        etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val query = s?.toString()?.trim() ?: ""
                searchJob?.cancel()
                searchJob = lifecycleScope.launch {
                    delay(300)
                    fetchGiphyGifs(query)
                }
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun fetchGiphyGifs(query: String) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val isSearching = query.isNotBlank()
                val queryTerm = if (isSearching) query else if (currentCategory != "All") currentCategory else ""
                val url = if (queryTerm.isNotBlank()) {
                    val encoded = URLEncoder.encode(queryTerm, "UTF-8")
                    "https://api.giphy.com/v1/gifs/search?api_key=$giphyApiKey&q=$encoded&limit=25&rating=g"
                } else {
                    "https://api.giphy.com/v1/gifs/trending?api_key=$giphyApiKey&limit=25&rating=g"
                }

                val request = Request.Builder().url(url).build()
                val response = httpClient.newCall(request).execute()
                val body = response.body?.string()

                if (response.isSuccessful && body != null) {
                    val json = JSONObject(body)
                    val dataArray = json.optJSONArray("data")
                    if (dataArray != null && dataArray.length() > 0) {
                        val parsed = mutableListOf<GifItem>()
                        for (i in 0 until dataArray.length()) {
                            val item = dataArray.getJSONObject(i)
                            val id = item.optString("id", "$i")
                            val title = item.optString("title", "GIPHY Animation")
                            val images = item.optJSONObject("images")
                            val originalUrl = images?.optJSONObject("original")?.optString("url")
                            val downsizedUrl = images?.optJSONObject("downsized")?.optString("url")
                            val fixedWidthUrl = images?.optJSONObject("fixed_width")?.optString("url")

                            val fullUrl = originalUrl ?: downsizedUrl ?: fixedWidthUrl ?: ""
                            val preview = fixedWidthUrl ?: downsizedUrl ?: fullUrl

                            if (fullUrl.isNotBlank()) {
                                parsed.add(GifItem(id, title, fullUrl, preview, "GIPHY"))
                            }
                        }

                        withContext(Dispatchers.Main) {
                            displayedGifs.clear()
                            displayedGifs.addAll(parsed)
                            adapter.notifyDataSetChanged()
                        }
                        return@launch
                    }
                }
            } catch (_: Exception) {}

            // Fallback to local curated
            val filtered = curatedGifs.filter { gif ->
                val matchesCategory = (currentCategory == "All") || gif.category.equals(currentCategory, ignoreCase = true)
                val matchesQuery = query.isEmpty() || gif.title.contains(query, ignoreCase = true) || gif.category.contains(query, ignoreCase = true)
                matchesCategory && matchesQuery
            }
            withContext(Dispatchers.Main) {
                displayedGifs.clear()
                displayedGifs.addAll(filtered)
                adapter.notifyDataSetChanged()
            }
        }
    }

    private class GifAdapter(
        private val gifs: List<GifItem>,
        private val onClick: (GifItem) -> Unit
    ) : RecyclerView.Adapter<GifAdapter.GifViewHolder>() {

        class GifViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val ivPreview: ImageView = view.findViewById(R.id.ivGifPreview)
            val tvTitle: TextView = view.findViewById(R.id.tvGifTitle)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): GifViewHolder {
            val view = LayoutInflater.from(parent.context).inflate(R.layout.item_gif, parent, false)
            return GifViewHolder(view)
        }

        override fun onBindViewHolder(holder: GifViewHolder, position: Int) {
            val gif = gifs[position]
            holder.tvTitle.text = gif.title
            holder.ivPreview.load(gif.previewUrl.ifEmpty { gif.url }) {
                crossfade(true)
                placeholder(R.drawable.bg_input_field)
            }
            holder.itemView.setOnClickListener { onClick(gif) }
        }

        override fun getItemCount(): Int = gifs.size
    }
}
