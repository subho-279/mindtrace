import { useRef, useState } from 'react'
import { Upload, File as FileIcon } from 'lucide-react'
import clsx from 'clsx'

export default function UploadZone({ accept, onFile, label = 'Upload file', hint = '' }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)

  const handle = (f) => {
    if (!f) return
    setFile(f)
    onFile(f)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]) }}
      className={clsx(
        'cursor-pointer border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-colors',
        dragging
          ? 'border-brand-500 bg-brand-500/10'
          : 'border-surface-border hover:border-brand-500/50 hover:bg-surface-hover'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => handle(e.target.files?.[0])}
      />
      {file ? (
        <>
          <FileIcon size={32} className="text-brand-400" />
          <div className="text-sm font-medium text-slate-200">{file.name}</div>
          <div className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</div>
        </>
      ) : (
        <>
          <Upload size={32} className="text-slate-500" />
          <div className="text-sm font-medium text-slate-300">{label}</div>
          {hint && <div className="text-xs text-slate-500">{hint}</div>}
        </>
      )}
    </div>
  )
}
