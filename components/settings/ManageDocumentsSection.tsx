'use client'

import { useState } from 'react'

interface Document {
  id: string
  file_name: string
  publicUrl: string | null
  storage_path: string
  size_bytes: number | null
  created_at?: string
}

interface ManageDocumentsSectionProps {
  documents: Document[]
  docsLoading: boolean
  deletingIds: Record<string, boolean>
  onDelete: (id: string) => void
  onView: (doc: Document) => void
}

export default function ManageDocumentsSection({
  documents,
  docsLoading,
  deletingIds,
  onDelete,
  onView,
}: ManageDocumentsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredDocs = documents.filter((doc) =>
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (docsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2 text-muted">
          <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Loading documents...
        </div>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted">No documents uploaded yet.</p>
        <p className="text-sm text-muted mt-2">Go to Home to upload your first document.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field w-full"
        />
      </div>

      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
        {filteredDocs.length === 0 ? (
          <div className="text-center py-8 text-muted">
            No documents found matching "{searchQuery}"
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const isDeleting = deletingIds[doc.id]
            const sizeMB = doc.size_bytes ? (doc.size_bytes / 1024 / 1024).toFixed(2) : '—'
            const dateStr = doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '—'

            return (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/8 transition-colors"
              >
                <div className="flex-1 min-w-0 mr-4">
                  <div className="font-medium truncate">{doc.file_name}</div>
                  <div className="text-xs text-muted mt-1">
                    {sizeMB} MB • Uploaded {dateStr}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onView(doc)}
                    className="btn-secondary text-sm px-3 py-1.5"
                    title="View PDF"
                  >
                    View
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${doc.file_name}"?`)) {
                        onDelete(doc.id)
                      }
                    }}
                    disabled={isDeleting}
                    className="btn-ghost text-sm px-3 py-1.5 text-red-400 hover:text-red-300 disabled:opacity-50"
                    title="Delete document"
                  >
                    {isDeleting ? (
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    ) : (
                      'Delete'
                    )}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="text-xs text-muted text-center pt-2 border-t border-white/10">
        {filteredDocs.length} of {documents.length} document{documents.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

