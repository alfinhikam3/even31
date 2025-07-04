"use client"
import React, { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'

const FONT_FAMILIES = [
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Times Roman', value: 'Times Roman' },
  { label: 'Courier', value: 'Courier' },
]

const DEFAULT_FIELDS = [
  { key: 'name', label: 'Nama Peserta', color: 'bg-blue-500', fontFamily: 'Helvetica', fontSize: 24, bold: false, italic: false },
  { key: 'event', label: 'Nama Event', color: 'bg-green-500', fontFamily: 'Helvetica', fontSize: 24, bold: false, italic: false },
  { key: 'number', label: 'Nomor Sertifikat', color: 'bg-purple-500', fontFamily: 'Helvetica', fontSize: 18, bold: false, italic: false },
  { key: 'date', label: 'Tanggal', color: 'bg-yellow-500', fontFamily: 'Helvetica', fontSize: 18, bold: false, italic: false },
  { key: 'token', label: 'Token', color: 'bg-pink-500', fontFamily: 'Helvetica', fontSize: 14, bold: false, italic: false },
]

const NUM_TEMPLATES = 6;

export default function GenerateCertificatesPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id
  const [activeTab, setActiveTab] = useState(0)
  const [templates, setTemplates] = useState<(File | null)[]>(Array(NUM_TEMPLATES).fill(null))
  const [templateUrls, setTemplateUrls] = useState<(string | null)[]>(Array(NUM_TEMPLATES).fill(null))
  const [fields, setFields] = useState<any[][]>(Array(NUM_TEMPLATES).fill(null).map(() => DEFAULT_FIELDS.map((f, i) => ({ ...f, x: 40 + i * 140, y: 30, active: true }))))
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const [saving, setSaving] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [activeFields, setActiveFields] = useState({
    name: true,
    event: true,
    number: true,
    date: true,
    token: true,
  })
  const [templateSizes, setTemplateSizes] = useState<({ width: number, height: number } | null)[]>(Array(NUM_TEMPLATES).fill(null))

  useEffect(() => {
    const fetchTemplates = async () => {
      const res = await fetch(`/api/events/${eventId}/generate-certificates/multi-template`);
      if (res.ok) {
        const data = await res.json();
        const loadedTemplates = Array(NUM_TEMPLATES).fill(null);
        const loadedUrls = Array(NUM_TEMPLATES).fill(null);
        const loadedFields = Array(NUM_TEMPLATES).fill(null).map(() => DEFAULT_FIELDS.map((f, i) => ({ ...f, x: 40 + i * 140, y: 30, active: true })));
        const loadedSizes = Array(NUM_TEMPLATES).fill(null);
        for (const t of data.templates) {
          const idx = t.templateIndex - 1;
          loadedUrls[idx] = t.templateUrl;
          loadedFields[idx] = t.fields;
          loadedSizes[idx] = t.templateSize;
        }
        setTemplateUrls(loadedUrls);
        setFields(loadedFields);
        setTemplateSizes(loadedSizes);
      }
    };
    fetchTemplates();
  }, [eventId]);

  // Perhitungan preview canvas: selalu aspect ratio A4 agar posisi field identik dengan PDF
  const A4_WIDTH = 842, A4_HEIGHT = 595;
  const PREVIEW_MAX_WIDTH = 420;
  const PREVIEW_MAX_HEIGHT = 297;
  let widthPreview = PREVIEW_MAX_WIDTH, heightPreview = PREVIEW_MAX_HEIGHT;
  if (templateSizes[activeTab]) {
    // Selalu pakai aspect ratio A4
    widthPreview = PREVIEW_MAX_WIDTH;
    heightPreview = PREVIEW_MAX_WIDTH * (A4_HEIGHT / A4_WIDTH);
  }

  const handleTabChange = (idx: number) => setActiveTab(idx)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0]
    if (file) {
      setTemplates(t => { const arr = [...t]; arr[idx] = file; return arr; })
      const url = URL.createObjectURL(file)
      setTemplateUrls(u => { const arr = [...u]; arr[idx] = url; return arr; })
      const img = new window.Image()
      img.onload = () => {
        setTemplateSizes(s => { const arr = [...s]; arr[idx] = { width: img.naturalWidth, height: img.naturalHeight }; return arr; })
      }
      img.src = url
    }
  }

  // Refactor drag & drop: parent menangani semua event
  const previewRef = useRef<HTMLDivElement>(null)

  // Simpan posisi offset saat mulai drag
  const handleFieldPointerDown = (idx: number, clientX: number, clientY: number) => {
    setDragIndex(idx)
    if (!templateSizes[activeTab]) return
    const preview = previewRef.current
    if (!preview) return
    const rect = preview.getBoundingClientRect()
    setOffset({
      x: clientX - (fields[activeTab][idx].x / templateSizes[activeTab].width) * widthPreview - rect.left,
      y: clientY - (fields[activeTab][idx].y / templateSizes[activeTab].height) * heightPreview - rect.top,
    })
  }

  // Handler drag di parent
  const handlePointerMove = (clientX: number, clientY: number) => {
    if (dragIndex === null || !templateSizes[activeTab]) return
    const preview = previewRef.current
    if (!preview) return
    const rect = preview.getBoundingClientRect()
    let x = ((clientX - offset.x - rect.left) / widthPreview) * templateSizes[activeTab].width
    let y = ((clientY - offset.y - rect.top) / heightPreview) * templateSizes[activeTab].height
    // Clamp agar tidak keluar area
    x = Math.max(0, Math.min(x, templateSizes[activeTab].width - 1))
    y = Math.max(0, Math.min(y, templateSizes[activeTab].height - 1))
    setFields(f => {
      const arr = f.map(fieldsArr => fieldsArr.map((field, i) => i === dragIndex ? { ...field, x, y } : field))
      return arr;
    })
  }

  // Handler mouse/touch event di parent
  const handleMouseDown = (e: React.MouseEvent) => {
    // Tidak melakukan apapun jika klik di luar field
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragIndex !== null) {
      handlePointerMove(e.clientX, e.clientY)
    }
  }
  const handleMouseUp = () => setDragIndex(null)
  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragIndex !== null && e.touches.length > 0) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)
    }
  }
  const handleTouchEnd = () => setDragIndex(null)

  // Toggle field aktif
  const handleToggleField = (key: string, checked: boolean) => {
    setFields(f => {
      const arr = f.map(fieldsArr => fieldsArr.map(field => field.key === key ? { ...field, active: checked } : field))
      return arr;
    })
  }

  // Inisialisasi posisi field agar tidak tumpuk (spread horizontal di atas template)
  useEffect(() => {
    setFields(f => f.map(fieldsArr => fieldsArr.map((f, i) => ({
      ...f,
      x: 40 + i * 140,
      y: 30,
      active: typeof f.active === 'boolean' ? f.active : true
    }))))
  }, [])

  // Simpan template & posisi ke backend
  const handleSave = async () => {
    const idx = activeTab
    if (!templateUrls[idx] || !templateSizes[idx]) return toast.error('Upload template terlebih dahulu!')
    setSaving(true)
    const formData = new FormData()
    if (templates[idx]) formData.append('template', templates[idx] as File)
    formData.append('fields', JSON.stringify(fields[idx]))
    formData.append('template_index', String(idx + 1))
    const res = await fetch(`/api/events/${eventId}/generate-certificates/multi-template`, { method: 'POST', body: formData })
    if (res.ok) toast.success('Template & posisi field berhasil disimpan!')
    else toast.error('Gagal menyimpan template!')
    setSaving(false)
  }

  // Preview sertifikat (ambil dari backend)
  const handlePreview = async (participantId: string) => {
    setPreviewUrl(null)
    const idx = activeTab
    const res = await fetch(`/api/events/${eventId}/generate-certificates/multi-template/preview`, {
      method: 'POST',
      body: JSON.stringify({ participantId, templateIndex: idx + 1 }),
      headers: { 'Content-Type': 'application/json' }
    })
    if (res.ok) {
      const blob = await res.blob()
      setPreviewUrl(URL.createObjectURL(blob))
    } else {
      toast.error('Gagal generate preview!')
    }
  }

  // Generate batch sertifikat
  const handleGenerate = async (participantId: string) => {
    setGenerating(true)
    const res = await fetch(`/api/events/${eventId}/generate-certificates/multi-template/generate`, {
      method: 'POST',
      body: JSON.stringify({ participantId }),
      headers: { 'Content-Type': 'application/json' }
    })
    if (res.ok) toast.success('Sertifikat multi berhasil digenerate!')
    else toast.error('Gagal generate sertifikat multi!')
    setGenerating(false)
  }

  return (
    <div className="min-h-screen bg-white w-full">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Generate Certificates (Multi-Desain)</h1>
              <p className="text-sm text-gray-500">Design and generate up to 6 certificate designs for event participants.</p>
            </div>
            <button onClick={() => router.back()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Event</span>
            </button>
          </div>
        </div>
      </header>
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-8 py-4 sm:py-8">
        <Toaster position="top-right" />
        <div className="mb-4 flex gap-2">
          {[...Array(NUM_TEMPLATES)].map((_, idx) => (
            <button
              key={idx}
              className={`px-4 py-2 rounded-t-lg border-b-2 font-semibold ${activeTab === idx ? 'border-purple-600 text-purple-700 bg-purple-50' : 'border-gray-200 text-gray-500 bg-gray-100'}`}
              onClick={() => handleTabChange(idx)}
            >
              Desain {idx + 1}
            </button>
          ))}
        </div>
        <div className="bg-white rounded-lg shadow-lg p-4">
          <p className="mb-2 text-gray-600 text-sm">Upload template sertifikat (PNG/JPG, ukuran A4), lalu atur posisi field secara interaktif untuk desain ke-{activeTab + 1}.</p>
          <input type="file" accept="image/png,image/jpeg" onChange={e => handleFileChange(e, activeTab)} className="mb-2 w-full max-w-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-4">
            {fields[activeTab].map((f, idx) => (
              <div
                key={f.key}
                className={`flex flex-col gap-2 p-3 rounded-xl border shadow-sm transition-all bg-white relative group
                  ${f.active ? 'border-purple-500 ring-1 ring-purple-200' : 'border-gray-200 opacity-70'}
                `}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={f.active}
                    onChange={e => handleToggleField(f.key, e.target.checked)}
                    className="accent-purple-600 w-5 h-5 rounded focus:ring-2 focus:ring-purple-400 transition-all cursor-pointer border-2 border-gray-300"
                    id={`field-active-${f.key}`}
                  />
                  <label htmlFor={`field-active-${f.key}`} className="font-semibold text-base text-gray-800 select-none cursor-pointer">
                    {f.label}
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <select
                      value={f.fontFamily}
                      onChange={e => {
                        setFields(f => {
                          const arr = f.map(fieldsArr => fieldsArr.map((field, i) => i === idx ? { ...field, fontFamily: e.target.value } : field))
                          return arr;
                        })
                      }}
                      className="flex-1 rounded-md border px-2 py-1 text-xs focus:ring-1 focus:ring-purple-400"
                      title="Font Family"
                    >
                      {FONT_FAMILIES.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={8}
                      max={72}
                      value={f.fontSize}
                      onChange={e => {
                        setFields(f => {
                          const arr = f.map(fieldsArr => fieldsArr.map((field, i) => i === idx ? { ...field, fontSize: Number(e.target.value) } : field))
                          return arr;
                        })
                      }}
                      className="w-16 rounded-md border px-2 py-1 text-xs focus:ring-1 focus:ring-purple-400"
                      title="Font Size"
                    />
                    <label className="flex items-center gap-1 cursor-pointer pl-2">
                      <input
                        type="checkbox"
                        checked={!!f.bold}
                        onChange={e => {
                          setFields(f => {
                            const arr = f.map(fieldsArr => fieldsArr.map((field, i) => i === idx ? { ...field, bold: e.target.checked } : field))
                            return arr;
                          })
                        }}
                        className="accent-purple-600 w-4 h-4 rounded cursor-pointer"
                        title="Bold"
                      />
                      <span className="font-bold text-sm text-gray-700">B</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!f.italic}
                        onChange={e => {
                          setFields(f => {
                            const arr = f.map(fieldsArr => fieldsArr.map((field, i) => i === idx ? { ...field, italic: e.target.checked } : field))
                            return arr;
                          })
                        }}
                        className="accent-purple-600 w-4 h-4 rounded cursor-pointer"
                        title="Italic"
                      />
                      <span className="italic text-sm text-gray-700">I</span>
                    </label>
                </div>
              </div>
            ))}
          </div>
          {templateUrls[activeTab] && templateSizes[activeTab] && (
            <>
              {/* Warning jika aspect ratio template tidak sama dengan A4 */}
              {Math.abs((templateSizes[activeTab].width / templateSizes[activeTab].height) - (A4_WIDTH / A4_HEIGHT)) > 0.01 && (
                <div className="mb-2 p-2 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold">
                  <b>Warning:</b> Aspect ratio template ({templateSizes[activeTab].width}x{templateSizes[activeTab].height}) tidak sama dengan A4 (842x595). Posisi field di hasil PDF bisa melenceng. Disarankan upload template berukuran 842x595 pixel.
                </div>
              )}
              <div
                ref={previewRef}
                className="template-preview relative border rounded-lg overflow-x-auto overflow-y-auto mt-4 shadow-lg bg-white mx-auto w-full"
                style={{ width: widthPreview, height: heightPreview, maxWidth: '100%', maxHeight: '70vw', minHeight: 180, aspectRatio: '842/595' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <img
                  ref={imgRef}
                  src={templateUrls[activeTab]}
                  alt="Template Preview"
                  className="w-full h-full object-contain select-none"
                  draggable={false}
                  style={{ position: 'absolute', left: 0, top: 0, width: widthPreview, height: heightPreview }}
                />
                {fields[activeTab].map((field, idx) => (
                  field.active && (
                    <div
                      key={field.key}
                      className={`absolute cursor-move px-2 py-1 rounded shadow text-black text-xs font-bold select-none ${field.color} ${dragIndex === idx ? 'z-30' : 'z-10'}`}
                      style={{
                        left: (field.x / templateSizes[activeTab].width) * widthPreview,
                        top: (field.y / templateSizes[activeTab].height) * heightPreview,
                        opacity: dragIndex === idx ? 0.7 : 1,
                        fontFamily: field.fontFamily,
                        fontSize: field.fontSize * (widthPreview / A4_WIDTH),
                        fontWeight: field.bold ? 'bold' : 'normal',
                        fontStyle: field.italic ? 'italic' : 'normal',
                        maxWidth: '90vw',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: dragIndex === idx ? 'grabbing' : 'move',
                        pointerEvents: 'auto',
                      }}
                      onMouseDown={e => {
                        e.stopPropagation();
                        handleFieldPointerDown(idx, e.clientX, e.clientY)
                      }}
                      onTouchStart={e => {
                        e.stopPropagation();
                        if (e.touches.length > 0) {
                          handleFieldPointerDown(idx, e.touches[0].clientX, e.touches[0].clientY)
                        }
                      }}
                    >
                      {field.label}
                    </div>
                  )
                ))}
              </div>
            </>
          )}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-4 w-full">
            <button onClick={handleSave} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow transition-all w-full sm:w-auto text-sm" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Template & Posisi'}</button>
            <button onClick={() => handlePreview('SAMPLE_PARTICIPANT_ID')} className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white font-semibold shadow transition-all w-full sm:w-auto text-sm">Preview Sertifikat</button>
            <button onClick={() => handleGenerate('SAMPLE_PARTICIPANT_ID')} className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow transition-all w-full sm:w-auto text-sm" disabled={generating}>{generating ? 'Menggenerate...' : 'Generate Sertifikat Multi'}</button>
          </div>
          {previewUrl && (
            <div className="mt-6">
              <h3 className="font-bold mb-2 bg-blue-600 text-white px-2 py-1 rounded text-sm">Preview Sertifikat (Desain {activeTab + 1}):</h3>
              <iframe src={previewUrl} className="w-full h-[220px] sm:h-[400px] md:h-[600px] border rounded shadow bg-white" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 