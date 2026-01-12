"use client"

import { useState } from "react"
import { UploadIcon, FileTextIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface InvoiceFileSelectorProps {
  file: File | null
  setFile: (file: File | null) => void
}

export function InvoiceFileSelector({
  file,
  setFile,
}: InvoiceFileSelectorProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleFileSelect = (selectedFile: File) => {
    // Basic validation (UI-level only)
    if (!selectedFile.type.startsWith("image/") && selectedFile.type !== "application/pdf") {
      alert("Only images or PDF files are allowed")
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB")
      return
    }

    setFile(selectedFile)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
          ${isDragging ? "border-orange-500 bg-orange-500/10" : "border-gray-700"}
          ${file ? "opacity-70" : ""}
        `}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById("invoice-file-input")?.click()}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center">
            <UploadIcon className="w-6 h-6 text-white" />
          </div>

          <div>
            <p className="text-sm font-medium text-white">
              Drag & drop invoice here
            </p>
            <p className="text-xs text-gray-400">
              or click to browse (PNG, JPG, PDF • max 5MB)
            </p>
          </div>
        </div>
      </div>

      {/* Hidden input */}
      <input
        id="invoice-file-input"
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files[0])
          }
        }}
      />

      {/* Selected file preview */}
      {file && (
        <div className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-md px-4 py-2">
          <div className="flex items-center gap-2">
            <FileTextIcon className="w-4 h-4 text-orange-400" />
            <div>
              <p className="text-sm text-white">{file.name}</p>
              <p className="text-xs text-gray-400">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFile(null)}
            className="text-gray-400 hover:text-red-500"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
