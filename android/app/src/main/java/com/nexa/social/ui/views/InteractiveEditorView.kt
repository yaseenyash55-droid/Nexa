package com.nexa.social.ui.views

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View

class InteractiveEditorView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    data class TextOverlay(
        var text: String,
        var color: Int,
        var size: Float,
        var x: Float,
        var y: Float
    )

    data class StrokePath(
        val path: Path,
        val color: Int,
        val width: Float
    )

    data class StateSnapshot(
        val strokePaths: List<StrokePath>,
        val textOverlays: List<TextOverlay>,
        val filterName: String
    )

    private var bgBitmap: Bitmap? = null
    private val strokePaths = mutableListOf<StrokePath>()
    private val textOverlays = mutableListOf<TextOverlay>()
    private var activeFilterName: String = "none"

    // History stack for Undo/Redo
    private val history = mutableListOf<StateSnapshot>()
    private var historyIndex = -1

    // Drawing options
    var isDrawingMode: Boolean = false
    var activeBrushColor: Int = Color.WHITE
    var brushWidth: Float = 14f

    private var drawPath = Path()
    private var drawPaint = Paint().apply {
        isAntiAlias = true
        style = Paint.Style.STROKE
        strokeJoin = Paint.Join.ROUND
        strokeCap = Paint.Cap.ROUND
    }

    private var draggingText: TextOverlay? = null
    private var dragOffsetX = 0f
    private var dragOffsetY = 0f

    init {
        saveState()
    }

    fun setBackgroundBitmap(bitmap: Bitmap) {
        this.bgBitmap = bitmap
        invalidate()
    }

    fun applyColorFilter(filterName: String) {
        activeFilterName = filterName
        saveState()
        invalidate()
    }

    fun addTextOverlay(text: String, color: Int) {
        val size = 48f
        val newText = TextOverlay(
            text = text,
            color = color,
            size = size,
            x = width / 3f,
            y = height / 2f
        )
        textOverlays.add(newText)
        saveState()
        invalidate()
    }

    fun undo(): Boolean {
        if (historyIndex > 0) {
            historyIndex--
            restoreState(history[historyIndex])
            return true
        }
        return false
    }

    fun redo(): Boolean {
        if (historyIndex < history.size - 1) {
            historyIndex++
            restoreState(history[historyIndex])
            return true
        }
        return false
    }

    private fun saveState() {
        // Clear redo states
        while (history.size > historyIndex + 1) {
            history.removeAt(history.size - 1)
        }

        // Deep copy items
        val pathsCopy = strokePaths.map { StrokePath(Path(it.path), it.color, it.width) }
        val textsCopy = textOverlays.map { it.copy() }
        history.add(StateSnapshot(pathsCopy, textsCopy, activeFilterName))
        historyIndex = history.size - 1
    }

    private fun restoreState(snapshot: StateSnapshot) {
        strokePaths.clear()
        strokePaths.addAll(snapshot.strokePaths.map { StrokePath(Path(it.path), it.color, it.width) })
        textOverlays.clear()
        textOverlays.addAll(snapshot.textOverlays.map { it.copy() })
        activeFilterName = snapshot.filterName
        invalidate()
    }

    private fun getFilterPaint(): Paint {
        val paint = Paint()
        val matrix = ColorMatrix()
        when (activeFilterName) {
            "warm" -> {
                // Boost red and yellow tints slightly
                matrix.setScale(1.2f, 1.0f, 0.8f, 1.0f)
            }
            "cool" -> {
                // Boost blue tint
                matrix.setScale(0.8f, 1.0f, 1.2f, 1.0f)
            }
            "grayscale" -> {
                matrix.setSaturation(0f)
            }
            "contrast" -> {
                val scale = 1.4f
                val translate = (-.5f * scale + .5f) * 255f
                val contrastMatrix = floatArrayOf(
                    scale, 0f, 0f, 0f, translate,
                    0f, scale, 0f, 0f, translate,
                    0f, 0f, scale, 0f, translate,
                    0f, 0f, 0f, 1f, 0f
                )
                matrix.set(contrastMatrix)
            }
            else -> {
                return paint
            }
        }
        paint.colorFilter = ColorMatrixColorFilter(matrix)
        return paint
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val bmp = bgBitmap ?: return

        // 1. Draw background image fitting the canvas view bounds
        val viewWidth = width.toFloat()
        val viewHeight = height.toFloat()
        val bmpWidth = bmp.width.toFloat()
        val bmpHeight = bmp.height.toFloat()

        val scale = Math.min(viewWidth / bmpWidth, viewHeight / bmpHeight)
        val dx = (viewWidth - bmpWidth * scale) / 2f
        val dy = (viewHeight - bmpHeight * scale) / 2f

        val destRect = RectF(dx, dy, dx + bmpWidth * scale, dy + bmpHeight * scale)
        canvas.drawBitmap(bmp, null, destRect, getFilterPaint())

        // 2. Draw active lines/strokes
        strokePaths.forEach { stroke ->
            drawPaint.color = stroke.color
            drawPaint.strokeWidth = stroke.width
            canvas.drawPath(stroke.path, drawPaint)
        }

        // Draw current path in progress
        if (isDrawingMode && !drawPath.isEmpty) {
            drawPaint.color = activeBrushColor
            drawPaint.strokeWidth = brushWidth
            canvas.drawPath(drawPath, drawPaint)
        }

        // 3. Draw text overlays
        val textPaint = Paint().apply {
            isAntiAlias = true
            style = Paint.Style.FILL
            typeface = Typeface.DEFAULT_BOLD
        }

        textOverlays.forEach { textOverlay ->
            textPaint.color = textOverlay.color
            textPaint.textSize = textOverlay.size
            canvas.drawText(textOverlay.text, textOverlay.x, textOverlay.y, textPaint)
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val x = event.x
        val y = event.y

        if (isDrawingMode) {
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    drawPath.reset()
                    drawPath.moveTo(x, y)
                    invalidate()
                }
                MotionEvent.ACTION_MOVE -> {
                    drawPath.lineTo(x, y)
                    invalidate()
                }
                MotionEvent.ACTION_UP -> {
                    drawPath.lineTo(x, y)
                    strokePaths.add(StrokePath(Path(drawPath), activeBrushColor, brushWidth))
                    drawPath.reset()
                    saveState()
                    invalidate()
                }
            }
            return true
        } else {
            // Drag texts
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    // Check top-down (newest first) for text hits
                    val checkPaint = Paint().apply { typeface = Typeface.DEFAULT_BOLD }
                    for (i in textOverlays.indices.reversed()) {
                        val textOverlay = textOverlays[i]
                        checkPaint.textSize = textOverlay.size
                        val bounds = Rect()
                        checkPaint.getTextBounds(textOverlay.text, 0, textOverlay.text.length, bounds)
                        
                        val textWidth = bounds.width()
                        val textHeight = bounds.height()
                        
                        // Bounds checking
                        if (x >= textOverlay.x && x <= textOverlay.x + textWidth &&
                            y >= textOverlay.y - textHeight && y <= textOverlay.y
                        ) {
                            draggingText = textOverlay
                            dragOffsetX = x - textOverlay.x
                            dragOffsetY = y - textOverlay.y
                            break
                        }
                    }
                    return draggingText != null
                }
                MotionEvent.ACTION_MOVE -> {
                    draggingText?.let {
                        it.x = x - dragOffsetX
                        it.y = y - dragOffsetY
                        invalidate()
                    }
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    if (draggingText != null) {
                        draggingText = null
                        saveState()
                    }
                    return true
                }
            }
        }
        return super.onTouchEvent(event)
    }

    fun getFlattenedBitmap(): Bitmap? {
        val bmp = bgBitmap ?: return null
        
        // Output scaled to original bitmap size
        val finalBmp = Bitmap.createBitmap(bmp.width, bmp.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(finalBmp)

        // 1. Draw filtered original bitmap
        canvas.drawBitmap(bmp, 0f, 0f, getFilterPaint())

        // 2. Draw scaled paths & texts
        val viewWidth = width.toFloat()
        val viewHeight = height.toFloat()
        val bmpWidth = bmp.width.toFloat()
        val bmpHeight = bmp.height.toFloat()

        val scale = Math.min(viewWidth / bmpWidth, viewHeight / bmpHeight)
        val dx = (viewWidth - bmpWidth * scale) / 2f
        val dy = (viewHeight - bmpHeight * scale) / 2f

        val scaleToOriginal = 1f / scale
        val matrix = Matrix().apply {
            postTranslate(-dx, -dy)
            postScale(scaleToOriginal, scaleToOriginal)
        }

        // Draw paths
        val finalPaint = Paint().apply {
            isAntiAlias = true
            style = Paint.Style.STROKE
            strokeJoin = Paint.Join.ROUND
            strokeCap = Paint.Cap.ROUND
        }

        strokePaths.forEach { stroke ->
            finalPaint.color = stroke.color
            finalPaint.strokeWidth = stroke.width * scaleToOriginal
            val pathCopy = Path(stroke.path)
            pathCopy.transform(matrix)
            canvas.drawPath(pathCopy, finalPaint)
        }

        // Draw texts
        val finalTxtPaint = Paint().apply {
            isAntiAlias = true
            style = Paint.Style.FILL
            typeface = Typeface.DEFAULT_BOLD
        }

        textOverlays.forEach { textOverlay ->
            finalTxtPaint.color = textOverlay.color
            finalTxtPaint.textSize = textOverlay.size * scaleToOriginal
            val mappedCoords = floatArrayOf(textOverlay.x, textOverlay.y)
            matrix.mapPoints(mappedCoords)
            canvas.drawText(textOverlay.text, mappedCoords[0], mappedCoords[1], finalTxtPaint)
        }

        return finalBmp
    }
}
