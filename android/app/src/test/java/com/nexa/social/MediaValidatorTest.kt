package com.nexa.social

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MediaValidatorTest {

    private fun detectMimeType(header: ByteArray): String? {
        if (header.size >= 3 &&
            header[0] == 0xFF.toByte() &&
            header[1] == 0xD8.toByte() &&
            header[2] == 0xFF.toByte()
        ) {
            return "image/jpeg"
        }

        if (header.size >= 4 &&
            header[0] == 0x89.toByte() &&
            header[1] == 0x50.toByte() &&
            header[2] == 0x4E.toByte() &&
            header[3] == 0x47.toByte()
        ) {
            return "image/png"
        }

        if (header.size >= 12 &&
            header[0] == 'R'.code.toByte() &&
            header[1] == 'I'.code.toByte() &&
            header[2] == 'F'.code.toByte() &&
            header[3] == 'F'.code.toByte() &&
            header[8] == 'W'.code.toByte() &&
            header[9] == 'E'.code.toByte() &&
            header[10] == 'B'.code.toByte() &&
            header[11] == 'P'.code.toByte()
        ) {
            return "image/webp"
        }

        return null
    }

    @Test
    fun `detects valid JPEG magic bytes`() {
        val jpegHeader = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xE0.toByte())
        assertEquals("image/jpeg", detectMimeType(jpegHeader))
    }

    @Test
    fun `detects valid PNG magic bytes`() {
        val pngHeader = byteArrayOf(0x89.toByte(), 0x50.toByte(), 0x4E.toByte(), 0x47.toByte(), 0x0D.toByte(), 0x0A.toByte(), 0x1A.toByte(), 0x0A.toByte())
        assertEquals("image/png", detectMimeType(pngHeader))
    }

    @Test
    fun `detects valid WebP magic bytes`() {
        val webpHeader = "RIFF1234WEBP".toByteArray(Charsets.US_ASCII)
        assertEquals("image/webp", detectMimeType(webpHeader))
    }

    @Test
    fun `rejects invalid magic bytes and executable headers`() {
        // Windows PE executable header "MZ"
        val exeHeader = byteArrayOf(0x4D.toByte(), 0x5A.toByte(), 0x90.toByte(), 0x00.toByte())
        assertNull(detectMimeType(exeHeader))

        // PDF header "%PDF"
        val pdfHeader = "%PDF-1.4".toByteArray()
        assertNull(detectMimeType(pdfHeader))

        // Short bytes
        assertNull(detectMimeType(byteArrayOf(0xFF.toByte(), 0xD8.toByte())))
    }
}
