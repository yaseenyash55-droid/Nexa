package com.nexa.social.ui

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.nexa.social.R
import com.nexa.social.databinding.ActivityStoryEditorBinding
import java.io.File
import java.io.FileOutputStream

class StoryEditorActivity : AppCompatActivity() {
    private lateinit var binding: ActivityStoryEditorBinding
    private var imageUri: Uri? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityStoryEditorBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val uriString = intent.getStringExtra(EXTRA_IMAGE_URI)
        if (uriString.isNullOrEmpty()) {
            Toast.makeText(this, "No image URI received", Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        imageUri = Uri.parse(uriString)

        loadSourceBitmap()
        setupListeners()
    }

    private fun loadSourceBitmap() {
        val uri = imageUri ?: return
        try {
            val inputStream = contentResolver.openInputStream(uri)
            val bitmap = BitmapFactory.decodeStream(inputStream)
            inputStream?.close()

            if (bitmap != null) {
                binding.editorView.setBackgroundBitmap(bitmap)
            } else {
                throw IllegalStateException("Failed to decode bitmap stream")
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Unable to load image: ${e.message}", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    private fun setupListeners() {
        binding.btnClose.setOnClickListener { finish() }

        binding.btnUndo.setOnClickListener {
            val undone = binding.editorView.undo()
            if (!undone) {
                Toast.makeText(this, "Nothing to undo", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnRedo.setOnClickListener {
            val redone = binding.editorView.redo()
            if (!redone) {
                Toast.makeText(this, "Nothing to redo", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnBrushMode.setOnClickListener {
            val newMode = !binding.editorView.isDrawingMode
            binding.editorView.isDrawingMode = newMode
            binding.btnBrushMode.setBackgroundResource(
                if (newMode) R.drawable.bg_unread_badge else R.drawable.bg_circle_outline
            )
            Toast.makeText(
                this,
                if (newMode) "Brush enabled. Tap colors to paint." else "Drawing disabled",
                Toast.LENGTH_SHORT
            ).show()
        }

        binding.btnTextMode.setOnClickListener {
            showTextInputDialog()
        }

        // Color selection triggers
        binding.colorWhite.setOnClickListener { selectColor(Color.WHITE, it) }
        binding.colorRed.setOnClickListener { selectColor(Color.parseColor("#FF4B4B"), it) }
        binding.colorGreen.setOnClickListener { selectColor(Color.parseColor("#4BFF4B"), it) }
        binding.colorYellow.setOnClickListener { selectColor(Color.parseColor("#FFD24B"), it) }

        // Filter chips selectors
        binding.chipFilterOriginal.setOnClickListener { binding.editorView.applyColorFilter("none") }
        binding.chipFilterWarm.setOnClickListener { binding.editorView.applyColorFilter("warm") }
        binding.chipFilterCool.setOnClickListener { binding.editorView.applyColorFilter("cool") }
        binding.chipFilterGrayscale.setOnClickListener { binding.editorView.applyColorFilter("grayscale") }
        binding.chipFilterContrast.setOnClickListener { binding.editorView.applyColorFilter("contrast") }

        binding.btnDone.setOnClickListener {
            saveAndReturn()
        }
    }

    private fun selectColor(color: Int, view: View) {
        binding.editorView.activeBrushColor = color
        Toast.makeText(this, "Brush color updated", Toast.LENGTH_SHORT).show()
    }

    private fun showTextInputDialog() {
        val etInput = EditText(this).apply {
            hint = "Overlay text"
            setPadding(32, 32, 32, 32)
        }
        AlertDialog.Builder(this)
            .setTitle("Add Text overlay")
            .setView(etInput)
            .setPositiveButton("Add") { _, _ ->
                val text = etInput.text.toString().trim()
                if (text.isNotEmpty()) {
                    binding.editorView.addTextOverlay(text, binding.editorView.activeBrushColor)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun saveAndReturn() {
        val flattened = binding.editorView.getFlattenedBitmap()
        if (flattened == null) {
            Toast.makeText(this, "No image to save", Toast.LENGTH_SHORT).show()
            return
        }

        try {
            val cacheFile = File(cacheDir, "edited_story_${System.currentTimeMillis()}.jpg")
            val outputStream = FileOutputStream(cacheFile)
            flattened.compress(Bitmap.CompressFormat.JPEG, 90, outputStream)
            outputStream.flush()
            outputStream.close()

            val intent = Intent().apply {
                putExtra(EXTRA_EDITED_URI, Uri.fromFile(cacheFile).toString())
            }
            setResult(Activity.RESULT_OK, intent)
            finish()
        } catch (e: Exception) {
            Toast.makeText(this, "Failed to save edits: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    companion object {
        const val EXTRA_IMAGE_URI = "extraImageUri"
        const val EXTRA_EDITED_URI = "extraEditedUri"
    }
}
