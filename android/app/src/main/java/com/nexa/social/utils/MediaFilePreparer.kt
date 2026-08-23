package com.nexa.social.utils

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

object MediaFilePreparer {
    enum class Kind { IMAGE, VIDEO }

    data class PreparedMedia(
        val file: File,
        val mimeType: String
    )

    suspend fun prepare(
        context: Context,
        uri: Uri,
        kind: Kind = Kind.IMAGE,
        maxBytes: Long = 20L * 1024L * 1024L
    ): Result<PreparedMedia> = withContext(Dispatchers.IO) {
        runCatching {
            val contentResolver = context.contentResolver
            val inputStream = contentResolver.openInputStream(uri)
                ?: throw IllegalStateException("Cannot open selected file")

            val headerBytes = ByteArray(12)
            val bytesRead = inputStream.read(headerBytes)
            if (bytesRead < 3) {
                inputStream.close()
                throw IllegalStateException("File is empty or unreadable")
            }

            val mimeType = detectMimeType(headerBytes, kind)
                ?: contentResolver.getType(uri)
                ?: if (kind == Kind.IMAGE) "image/jpeg" else "video/mp4"

            val ext = when (mimeType) {
                "image/jpeg" -> ".jpg"
                "image/png" -> ".png"
                "image/webp" -> ".webp"
                "video/mp4" -> ".mp4"
                else -> if (kind == Kind.IMAGE) ".jpg" else ".mp4"
            }

            val tempFile = File.createTempFile("media_prep_", ext, context.cacheDir)
            val outputStream = FileOutputStream(tempFile)
            outputStream.write(headerBytes, 0, bytesRead)
            inputStream.copyTo(outputStream)
            inputStream.close()
            outputStream.flush()
            outputStream.close()

            if (tempFile.length() > maxBytes) {
                tempFile.delete()
                throw IllegalStateException("File size exceeds limit (${maxBytes / (1024 * 1024)} MB)")
            }

            PreparedMedia(tempFile, mimeType)
        }
    }

    private fun detectMimeType(header: ByteArray, kind: Kind): String? {
        if (kind == Kind.IMAGE) {
            if (header.size >= 3 && header[0] == 0xFF.toByte() && header[1] == 0xD8.toByte() && header[2] == 0xFF.toByte()) {
                return "image/jpeg"
            }
            if (header.size >= 4 && header[0] == 0x89.toByte() && header[1] == 0x50.toByte() && header[2] == 0x4E.toByte() && header[3] == 0x47.toByte()) {
                return "image/png"
            }
            if (header.size >= 12 && header[0] == 'R'.code.toByte() && header[1] == 'I'.code.toByte() && header[2] == 'F'.code.toByte() && header[3] == 'F'.code.toByte() &&
                header[8] == 'W'.code.toByte() && header[9] == 'E'.code.toByte() && header[10] == 'B'.code.toByte() && header[11] == 'P'.code.toByte()
            ) {
                return "image/webp"
            }
        }
        return null
    }
}
