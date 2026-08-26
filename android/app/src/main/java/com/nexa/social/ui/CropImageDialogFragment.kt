package com.nexa.social.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.DialogFragment
import com.nexa.social.databinding.DialogCropImageBinding
import java.io.File
import java.io.FileOutputStream

class CropImageDialogFragment : DialogFragment() {

    companion object {
        fun newInstance(
            sourceUri: Uri,
            aspectRatio: Float = 1f,
            onCropped: (Uri) -> Unit
        ): CropImageDialogFragment {
            return CropImageDialogFragment().apply {
                this.sourceUri = sourceUri
                this.targetAspectRatio = aspectRatio
                this.onCroppedCallback = onCropped
            }
        }
    }

    private var _binding: DialogCropImageBinding? = null
    private val binding get() = _binding!!

    private var sourceUri: Uri? = null
    private var targetAspectRatio: Float = 1f
    private var onCroppedCallback: ((Uri) -> Unit)? = null
    private var currentBitmap: Bitmap? = null
    private var rotationDegrees: Float = 0f

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = DialogCropImageBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        loadSourceBitmap()
        setupListeners()
    }

    private fun loadSourceBitmap() {
        val uri = sourceUri ?: return
        try {
            requireContext().contentResolver.openInputStream(uri)?.use { stream ->
                currentBitmap = BitmapFactory.decodeStream(stream)
            }
            binding.ivCropSource.setImageBitmap(currentBitmap)
        } catch (e: Exception) {
            Toast.makeText(context, "Failed to load image: ${e.message}", Toast.LENGTH_SHORT).show()
            dismiss()
        }
    }

    private fun setupListeners() {
        binding.btnRotate.setOnClickListener {
            rotationDegrees = (rotationDegrees + 90f) % 360f
            currentBitmap?.let { bmp ->
                val matrix = Matrix().apply { postRotate(90f) }
                currentBitmap = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, matrix, true)
                binding.ivCropSource.setImageBitmap(currentBitmap)
            }
        }

        binding.btnResetCrop.setOnClickListener {
            rotationDegrees = 0f
            loadSourceBitmap()
        }

        binding.btnCancelCrop.setOnClickListener {
            dismiss()
        }

        binding.btnApplyCrop.setOnClickListener {
            val bmp = currentBitmap ?: return@setOnClickListener
            try {
                // Crop according to targetAspectRatio
                val width = bmp.width
                val height = bmp.height
                val currentAspect = width.toFloat() / height.toFloat()

                val targetW: Int
                val targetH: Int
                if (currentAspect > targetAspectRatio) {
                    targetH = height
                    targetW = (height * targetAspectRatio).toInt()
                } else {
                    targetW = width
                    targetH = (width / targetAspectRatio).toInt()
                }

                val startX = maxOf(0, (width - targetW) / 2)
                val startY = maxOf(0, (height - targetH) / 2)
                val cropW = minOf(targetW, width - startX)
                val cropH = minOf(targetH, height - startY)

                val croppedBmp = Bitmap.createBitmap(bmp, startX, startY, cropW, cropH)

                // Save to cache file
                val tempFile = File.createTempFile("cropped_image_", ".jpg", requireContext().cacheDir)
                FileOutputStream(tempFile).use { out ->
                    croppedBmp.compress(Bitmap.CompressFormat.JPEG, 90, out)
                }

                val croppedUri = Uri.fromFile(tempFile)
                onCroppedCallback?.invoke(croppedUri)
                dismiss()
            } catch (e: Exception) {
                Toast.makeText(context, "Error cropping image: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
